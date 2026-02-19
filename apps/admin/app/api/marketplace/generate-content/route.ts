import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { verifyAdminAuth } from "@/lib/admin/auth";
import { readFile, access } from "fs/promises";
import { constants } from "fs";
import path from "path";

/**
 * Sanitize filename to prevent path traversal attacks
 * Only allows alphanumeric characters, hyphens, underscores, and dots
 * Removes any directory components
 */
function sanitizeFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") return null;
  
  // Get only the base filename (no directory components)
  const baseName = path.basename(filename);
  
  // Check for path traversal attempts
  if (baseName.includes("..") || baseName.includes("/") || baseName.includes("\\")) {
    return null;
  }
  
  // Only allow safe characters: alphanumeric, hyphen, underscore, dot
  if (!/^[a-zA-Z0-9_.-]+$/.test(baseName)) {
    return null;
  }
  
  // Must have a valid image extension
  const ext = baseName.split(".").pop()?.toLowerCase();
  if (!ext || !["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return null;
  }
  
  return baseName;
}

/**
 * POST /api/marketplace/generate-content
 * Uses OpenAI to generate title, short description, and full description
 * for ANY marketplace item type (indicators, strategies, game master packages, cosmetics)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      category,
      imageUrl,
      // Cosmetic specific
      cosmeticType,
      // Indicator specific
      indicatorType,
      defaultSettings,
      // Strategy specific
      strategyConfig,
      // Game Master specific
      gameMasterConfig,
      // Existing values (optional - for refinement)
      existingName,
      existingDescription,
    } = body;

    if (!category) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 },
      );
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("❌ [AI Generate] OPENAI_API_KEY not configured");
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 },
      );
    }

    const openai = new OpenAI({ apiKey });

    console.log(`🤖 [AI Generate] Processing ${category} item`);

    // Build the prompt based on category
    let systemPrompt = "";
    let userPrompt = "";
    let imageData: string | null = null;

    if (category === "cosmetic") {
      // For cosmetics, use image analysis
      if (!imageUrl) {
        return NextResponse.json(
          { error: "Image URL is required for cosmetics" },
          { status: 400 },
        );
      }

      // Convert image to base64
      imageData = await getImageBase64(imageUrl);
      if (!imageData) {
        return NextResponse.json(
          {
            error: "Could not find image file. Please try uploading again.",
          },
          { status: 400 },
        );
      }

      systemPrompt = getCosmeticPrompt(cosmeticType);
      userPrompt =
        "Carefully analyze this avatar image. Note all visual details: colors, weapons, armor, effects, pose, expression. Then create a unique name, tagline, and detailed backstory that accurately reflects what you see:";
    } else if (category === "indicator") {
      systemPrompt = getIndicatorPrompt(indicatorType, defaultSettings);
      userPrompt = `Generate compelling marketplace content for this trading indicator:\n\nIndicator Type: ${indicatorType || "custom"}\nSettings: ${JSON.stringify(defaultSettings || {}, null, 2)}`;
    } else if (category === "strategy") {
      systemPrompt = getStrategyPrompt(strategyConfig);
      userPrompt = `Generate compelling marketplace content for this trading strategy:\n\nStrategy Configuration: ${JSON.stringify(strategyConfig || {}, null, 2)}`;
    } else if (category === "gamemaster") {
      console.log(
        "🎮 [AI Generate] Game Master Config received:",
        JSON.stringify(gameMasterConfig, null, 2),
      );
      console.log(
        "🎮 [AI Generate] canCreateCompetitions value:",
        gameMasterConfig?.canCreateCompetitions,
      );
      systemPrompt = getGameMasterPrompt(gameMasterConfig);
      userPrompt = `Generate compelling marketplace content for this Game Master package:\n\nPackage Configuration: ${JSON.stringify(gameMasterConfig || {}, null, 2)}\n\nIMPORTANT: canCreateCompetitions is ${gameMasterConfig?.canCreateCompetitions === false ? "DISABLED - do NOT mention competition creation" : "ENABLED"}`;
      console.log(
        "🎮 [AI Generate] System prompt includes canCreateCompetitions check",
      );
    } else {
      return NextResponse.json(
        { error: `Unsupported category: ${category}` },
        { status: 400 },
      );
    }

    console.log(`🤖 [AI Generate] Calling OpenAI API for ${category}...`);

    // Build messages array
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    if (imageData && category === "cosmetic") {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: { url: imageData, detail: "high" },
          },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 1200,
      temperature: 0.85,
    });

    console.log(`✅ [AI Generate] OpenAI response received`);

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "Failed to generate content" },
        { status: 500 },
      );
    }

    console.log(`🤖 [AI Generate] Raw response:`, content);

    // Parse the JSON response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return NextResponse.json({
        success: true,
        generated: {
          name: "Generated Item",
          shortDescription: content.slice(0, 100),
          fullDescription: content,
        },
      });
    }

    console.log(`🤖 [AI Generate] Parsed result:`, parsed);

    return NextResponse.json({
      success: true,
      generated: {
        name: parsed.name || "Generated Item",
        shortDescription: parsed.shortDescription || parsed.tagline || "",
        fullDescription: parsed.fullDescription || parsed.description || "",
      },
    });
  } catch (error) {
    console.error("❌ [AI Generate] Error:", error);
    return NextResponse.json(
      {
        error:
          "Failed to generate content: " +
          (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 },
    );
  }
}

// Helper function to get image as base64
async function getImageBase64(imageUrl: string): Promise<string | null> {
  const urlPath = imageUrl.split("?")[0];
  const rawFilename = urlPath.split("/").pop() || "";
  
  // Sanitize filename to prevent path traversal attacks
  const filename = sanitizeFilename(rawFilename);
  if (!filename) {
    console.error(`❌ [AI Generate] Invalid filename: ${rawFilename}`);
    return null;
  }

  let mimeType = "image/png";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
  else if (ext === "gif") mimeType = "image/gif";
  else if (ext === "webp") mimeType = "image/webp";

  const possiblePaths = [
    path.join(
      "/var/www/chartvolt",
      "public",
      "uploads",
      "marketplace",
      filename,
    ),
    path.join(
      process.cwd(),
      "..",
      "..",
      "public",
      "uploads",
      "marketplace",
      filename,
    ),
    path.join(process.cwd(), "public", "uploads", "marketplace", filename),
  ];

  for (const filePath of possiblePaths) {
    try {
      await access(filePath, constants.R_OK);
      const fileBuffer = await readFile(filePath);
      console.log(`✅ [AI Generate] Found image at: ${filePath}`);
      return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
    } catch {
      // Try next path
    }
  }

  return null;
}

// Prompt for cosmetic avatars
function getCosmeticPrompt(cosmeticType?: string): string {
  return `You are a creative writer for a trading platform marketplace. You create compelling, unique names and rich backstories for cosmetic avatar items that traders can purchase.

IMPORTANT: Carefully analyze the actual image - note colors, weapons/items, clothing, pose, mood, and any distinctive features. Your description MUST match what's actually in the image.

Your task is to create:

1. **Name** (2-3 words max) - Epic, memorable, trading/gaming themed. Based on what you SEE in the image.

2. **Short Tagline** (max 100 characters) - Catchy one-liner describing the character.

3. **Full Description** - Use this EXACT format:

**Origin Story**
[2-3 paragraphs of creative lore about who this character is, their background, and their role in the trading world. Connect their appearance to their story.]

**Symbolism**
[List 4-5 visual elements you can see in the image and explain their trading-related meaning]
• [Visible Item/Feature]: [Trading symbolism]
• [Visible Color/Effect]: [What it represents]
• [Visible Armor/Clothing]: [Its meaning]
• [Visible Expression/Pose]: [What it conveys]

*"[A memorable quote from the character about trading]"*

The cosmetic type is: ${cosmeticType || "avatar"}

Respond in JSON format:
{
  "name": "Character Name",
  "shortDescription": "Short catchy tagline under 100 chars",
  "fullDescription": "**Origin Story**\\n[story paragraphs]\\n\\n**Symbolism**\\n• Item: Meaning\\n\\n*\\"Quote here\\"*"
}`;
}

// Prompt for trading indicators
function getIndicatorPrompt(
  indicatorType?: string,
  settings?: Record<string, unknown>,
): string {
  const indicatorNames: Record<string, string> = {
    sma: "Simple Moving Average",
    ema: "Exponential Moving Average",
    bb: "Bollinger Bands",
    rsi: "Relative Strength Index",
    macd: "MACD",
    support_resistance: "Support & Resistance Levels",
  };

  const indicatorName = indicatorType
    ? indicatorNames[indicatorType] || indicatorType
    : "Custom Indicator";

  return `You are a professional trading platform content writer. Create compelling marketplace content for a trading indicator.

The indicator type is: ${indicatorName}
Default settings: ${JSON.stringify(settings || {}, null, 2)}

Create content that:
1. Explains what the indicator does in simple terms
2. Highlights its benefits for traders
3. Mentions use cases and trading scenarios
4. Includes clear, beginner-friendly instructions on how to use the indicator on the platform
5. Is professional but engaging

Your task is to create:

1. **Name** (2-4 words max) - Professional, memorable. Can be creative but clear about what it does.

2. **Short Description** (max 120 characters) - One-liner explaining the indicator's main benefit.

3. **Full Description** - Use this EXACT format:

# [Indicator Name]

## Overview
[1-2 paragraphs explaining what the indicator does and why traders use it]

## How It Works
[Bullet points explaining the calculation/methodology]
- [Point 1]
- [Point 2]
- [Point 3]

## How to Use
[Step-by-step instructions for using this indicator on the platform]
1. After purchasing, go to the **Trading Chart** page.
2. Open the **Trading Arsenal** panel (the rocket icon on the left sidebar).
3. Find this indicator under your **Purchased Indicators** section.
4. Toggle it **ON** to add it to your chart.
5. [Explain what the user should look for on the chart -- e.g., line crossovers, color changes, zones, bands, etc.]
6. [Explain how to interpret the signals -- e.g., "When the line crosses above 70, the asset may be overbought", "When the upper and lower bands squeeze together, expect a breakout", etc.]
7. Combine with other indicators or price action for stronger confirmation before entering a trade.

## Settings
[List the configurable settings and what they do]
- **[Setting Name]**: [What it controls]

## Best Used For
[Bullet points of ideal use cases]
- [Use case 1]
- [Use case 2]
- [Use case 3]

## Pro Tips
[1-2 practical tips for using this indicator effectively]

Respond in JSON format:
{
  "name": "Indicator Name",
  "shortDescription": "Short description under 120 chars",
  "fullDescription": "# Title\\n\\n## Overview\\n[content]\\n\\n## How It Works\\n- [points]\\n\\n## How to Use\\n1. [steps]\\n\\n..."
}`;
}

// ── Strategy preview builder ─────────────────────────────────────────────────
// Converts strategyConfig into a human-readable preview identical to the
// Strategy Preview panel in the StrategyBuilder UI. This is injected verbatim
// into the AI prompt so the model understands every rule and signal type.
function buildStrategyPreview(config: Record<string, unknown>): string {
  const rules = (config.rules as Array<Record<string, unknown>>) || [];
  if (rules.length === 0) return "No rules defined.";

  const SIGNAL_LABELS: Record<string, string> = {
    strong_buy:  "STRONG BUY  🟢",
    buy:         "BUY  🟩",
    neutral:     "NEUTRAL  ⬜",
    sell:        "SELL  🟥",
    strong_sell: "STRONG SELL  🔴",
  };

  const SHAPE_LABELS: Record<string, string> = {
    arrowUp:   "Arrow Up ▲",
    arrowDown: "Arrow Down ▼",
    circle:    "Circle ●",
    square:    "Square ■",
  };

  const lines: string[] = [];

  rules.forEach((rule, idx) => {
    const name        = (rule.name as string) || `Rule ${idx + 1}`;
    const signal      = (rule.signal as string) || "buy";
    const strength    = (rule.signalStrength as number) ?? 3;
    const logic       = (rule.logic as string) || "AND";
    const shape       = rule.markerShape
      ? SHAPE_LABELS[rule.markerShape as string] ?? String(rule.markerShape)
      : "Auto (by signal type)";
    const color       = (rule.markerColor as string) || "Default signal color";
    const size        = rule.markerSize !== undefined ? String(rule.markerSize) : "Auto";
    const showLabel   = rule.showLabel !== false ? "Yes" : "No";
    const conditions  = (rule.conditions as Array<Record<string, unknown>>) || [];

    lines.push(`\nRule ${idx + 1}: "${name}"`);
    lines.push(`  → Signal:   ${SIGNAL_LABELS[signal] ?? signal.toUpperCase()}`);
    lines.push(`  → Strength: ${strength} / 5`);
    lines.push(`  → Marker:   Shape=${shape}  Color=${color}  Size=${size}  Show label=${showLabel}`);

    if (conditions.length === 0) {
      lines.push(`  → Conditions: (none)`);
    } else {
      lines.push(`  → Conditions (combined with ${logic}):`);
      conditions.forEach((c, ci) => {
        const ind     = c.indicator as string;
        const params  = c.indicatorParams
          ? ` (${Object.entries(c.indicatorParams as Record<string, number>).map(([k, v]) => `${k}=${v}`).join(", ")})`
          : "";
        const op      = (c.operator as string)?.replace(/_/g, " ") ?? "?";
        const compare =
          c.compareWith === "value"
            ? `value ${c.compareValue ?? 0}`
            : `${c.compareIndicator ?? "indicator"}${
                c.compareIndicatorParams
                  ? ` (${Object.entries(c.compareIndicatorParams as Record<string, number>).map(([k, v]) => `${k}=${v}`).join(", ")})`
                  : ""
              }`;
        lines.push(`     ${ci + 1}. ${ind}${params}  ${op}  ${compare}`);
      });
    }
  });

  // Signal display settings
  const display = config.signalDisplay as Record<string, unknown> | undefined;
  if (display) {
    lines.push(`\nDisplay settings:`);
    lines.push(`  Show on chart: ${display.showOnChart !== false ? "Yes" : "No"}`);
    lines.push(`  Show arrows:   ${display.showArrows !== false ? "Yes" : "No"}`);
    lines.push(`  Show labels:   ${display.showLabels !== false ? "Yes" : "No"}`);
    lines.push(`  Arrow size:    ${display.arrowSize ?? "medium"}`);
  }

  // Default indicators
  const defaultInds = (config.defaultIndicators as string[]) || [];
  if (defaultInds.length > 0) {
    lines.push(`\nDefault indicators enabled: ${defaultInds.join(", ")}`);
  }

  return lines.join("\n");
}

// Prompt for trading strategies
function getStrategyPrompt(strategyConfig?: Record<string, unknown>): string {
  const config = strategyConfig || {};
  const preview = buildStrategyPreview(config);
  const rulesCount = ((config.rules as unknown[]) || []).length;

  // Derive signal summary for the prompt context
  const rules = (config.rules as Array<Record<string, unknown>>) || [];
  const signalSummary = rules
    .map((r) => {
      const signal = (r.signal as string) || "buy";
      const name   = (r.name as string) || "Rule";
      const shape  = r.markerShape ? `shown as ${r.markerShape}` : "shown as arrow";
      const color  = r.markerColor ? ` in color ${r.markerColor}` : "";
      const label  = r.showLabel !== false ? " with label" : " without label";
      return `  • "${name}" → ${signal.replace(/_/g, " ").toUpperCase()} (strength ${r.signalStrength ?? 3}, ${shape}${color}${label})`;
    })
    .join("\n");

  return `You are a professional trading platform content writer. Create compelling marketplace content for an automated trading strategy.

═══════════════════════════════════════════════════════════
STRATEGY PREVIEW (${rulesCount} signal rule${rulesCount !== 1 ? "s" : ""})
═══════════════════════════════════════════════════════════
${preview}
═══════════════════════════════════════════════════════════

SIGNAL TYPES PRODUCED BY THIS STRATEGY:
${signalSummary || "  (none defined yet)"}

Raw configuration (for reference): ${JSON.stringify(config, null, 2)}

Create content that:
1. Explains each rule's logic in plain English — name the signal type it generates (Strong Buy, Buy, Sell, Strong Sell, Neutral)
2. Describes what the visual markers look like on the chart for each signal (arrow up/down, circle, square; the color and size if set)
3. Explains whether labels appear on markers or not
4. Highlights when and why the strategy generates each signal type
5. Mentions risk level and ideal market conditions
6. Includes clear, beginner-friendly instructions on how to activate and use the strategy on the platform
7. Is professional and builds confidence
8. References the actual rule names and signal types from the preview above

Your task is to create:

1. **Name** (2-4 words max) - Professional, memorable strategy name inspired by the actual rules.

2. **Short Description** (max 120 characters) - One-liner explaining the strategy's approach and signal types.

3. **Full Description** - Use this EXACT format:

# [Strategy Name]

## Overview
[1-2 paragraphs explaining the strategy philosophy. Reference the actual signal tiers — e.g. "This strategy produces ${rulesCount} signal types..."]

## Signal Rules
[For EACH rule in the strategy preview above, write a clear paragraph or bullet block:]
### [Rule Name] → [SIGNAL TYPE]
- Triggers when: [natural-language description of the conditions]
- Chart marker: [describe the shape, color, size, whether label shows]
- Strength: [strength value / 5]

## How to Use
1. After purchasing, go to the **Trading Chart** page.
2. Open the **Trading Arsenal** panel (the rocket icon on the left sidebar).
3. Find this strategy under your **Purchased Strategies** section.
4. Toggle it **ON** to activate it on your chart.
5. [Describe what each signal type looks like visually — reference the actual shapes and colors from the rules]
6. [Explain how to interpret each signal type for trade decisions]
7. Review each signal before placing a trade — use it as guidance, not a guarantee.
8. You can combine this strategy with other indicators from your Trading Arsenal for extra confirmation.

## Best Used For
[Ideal market conditions and trading styles based on the actual signal logic]
- [Use case 1]
- [Use case 2]

## Risk Warning
No strategy guarantees profits. This strategy is a decision-support tool. Always use proper risk management and never risk more than you can afford to lose.

*"[A memorable trading wisdom quote related to this specific strategy's approach]"*

Respond in JSON format:
{
  "name": "Strategy Name",
  "shortDescription": "Short description under 120 chars",
  "fullDescription": "# Title\\n\\n## Overview\\n[content]\\n\\n## Signal Rules\\n### Rule Name\\n- [details]\\n\\n## How to Use\\n1. [steps]\\n\\n## Risk Warning\\n..."
}`;
}

// Prompt for Game Master packages
function getGameMasterPrompt(config?: Record<string, unknown>): string {
  const gmConfig = config || {};
  const canCreateCompetitions = gmConfig.canCreateCompetitions !== false;
  const canEarnFromChallenges = gmConfig.canEarnFromChallenges === true;

  // Build the "What You Get" section based on enabled features
  let whatYouGetSection = "";

  if (canCreateCompetitions) {
    whatYouGetSection = `
- **${gmConfig.maxCompetitionsPerDay || 1} Competition${(gmConfig.maxCompetitionsPerDay || 1) > 1 ? "s" : ""} per Day** - Host engaging trading battles for your community
- **Up to ${gmConfig.maxUsersPerCompetition || 30} Participants** - Perfect size for competitive events
- **${gmConfig.referralFeePercentage || 5}% Referral Earnings** - Earn from every entry fee your referred users pay
- **${gmConfig.subscriptionDurationDays || 30} Days Duration** - Full subscription period`;
  } else {
    whatYouGetSection = `
- **${gmConfig.referralFeePercentage || 5}% Referral Earnings** - Earn from every entry fee your referred users pay in ANY competition
- **${gmConfig.subscriptionDurationDays || 30} Days Duration** - Full subscription period
- **Passive Income Focus** - No competition management required`;
  }

  if (canEarnFromChallenges) {
    whatYouGetSection += `
- **${gmConfig.challengeReferralFeePercentage || gmConfig.referralFeePercentage || 5}% Challenge Earnings** - Earn from 1v1 challenge referrals`;
  }

  const packageType = canCreateCompetitions
    ? "a full-featured Game Master subscription package that allows creating competitions AND earning from referrals"
    : "a referral-only Game Master package focused purely on earning from referrals (NO competition creation)";

  // Log for debugging
  console.log(
    "[getGameMasterPrompt] canCreateCompetitions:",
    canCreateCompetitions,
    "raw value:",
    gmConfig.canCreateCompetitions,
  );

  // Build strong constraint message for referral-only packages
  const referralOnlyConstraint = !canCreateCompetitions
    ? `

⚠️ CRITICAL CONSTRAINT - READ CAREFULLY:
This is a REFERRAL-ONLY package. Competition creation is DISABLED.

YOU MUST NOT include ANY of the following in the generated content:
- "Competition per Day" or similar
- "Max users per competition" or "participants per competition"
- "Host competitions" or "create competitions" or "run competitions"
- Any numbers related to competition limits
- Any mention of managing, hosting, or creating trading events

YOU MUST ONLY focus on:
- Referral earnings (the percentage they earn from referred users)
- Subscription duration
- Passive income through network building
- Earning from OTHER people's competitions (not their own)

The GM with this package earns fees when their referred users participate in competitions created by others (admins or other GMs), but they CANNOT create their own competitions.
`
    : "";

  return `You are a professional content writer for a trading competition platform. Create compelling marketplace content for ${packageType}.
${referralOnlyConstraint}
IMPORTANT: This package ${canCreateCompetitions ? "CAN create competitions and earn from referrals" : "CANNOT create competitions - it is REFERRAL-ONLY"}.

Package configuration:
- Subscription Duration: ${gmConfig.subscriptionDurationDays || 30} days
- Referral Fee Percentage: ${gmConfig.referralFeePercentage || 5}%
${
  canCreateCompetitions
    ? `- Max Competitions Per Day: ${gmConfig.maxCompetitionsPerDay || 1}
- Max Users Per Competition: ${gmConfig.maxUsersPerCompetition || 30}`
    : "- Competition Creation: DISABLED (Referral-Only Package)"
}
- Can Earn From Challenges: ${canEarnFromChallenges ? `Yes (${gmConfig.challengeReferralFeePercentage || gmConfig.referralFeePercentage || 5}%)` : "No"}

Create content that:
1. ${canCreateCompetitions ? "Highlights both competition hosting AND referral earning potential" : "Focuses ENTIRELY on passive referral income - DO NOT mention hosting competitions"}
2. Explains the earning potential from referrals
3. Makes the package feel exclusive and valuable
4. Uses aspirational language that appeals to traders

Your task is to create:

1. **Name** (2-4 words max) - ${canCreateCompetitions ? 'Tier name that conveys power (e.g., "Pro", "Elite", "Ultimate")' : 'Name that conveys passive income/influence (e.g., "Affiliate Pro", "Referral Master", "Network Builder")'}.

2. **Short Description** (max 120 characters) - Compelling one-liner about the package benefits. ${!canCreateCompetitions ? "Focus on referral earnings, NOT competitions." : ""}

3. **Full Description** - Use this EXACT format:

# [Package Name - Aspirational Title]

[Opening hook - 1 sentence about what this package enables. ${!canCreateCompetitions ? "DO NOT mention creating competitions." : ""}]

## What You Get
${whatYouGetSection}

## How Referral Earnings Work

[2-3 sentences explaining the passive income model - how GMs earn when their referred users join competitions${canEarnFromChallenges ? " and challenges" : ""}]

## Ideal For

- [Target audience 1 - ${canCreateCompetitions ? "community builders who want to host events" : "influencers who want passive income"}]
- [Target audience 2]
- [Target audience 3]

${
  !canCreateCompetitions
    ? `## Note
This is a referral-only package - perfect for influencers who want to earn from their network without the responsibility of managing competitions.`
    : ""
}

*"[Aspirational quote about ${canCreateCompetitions ? "building a trading community" : "monetizing your influence"}]"*

Respond in JSON format:
{
  "name": "Package Name",
  "shortDescription": "Short description under 120 chars",
  "fullDescription": "# Title\\n\\n[Opening]\\n\\n## What You Get\\n- [benefits]\\n\\n..."
}`;
}
