/**
 * AI Competition Content Generator API
 *
 * Generates creative competition titles and descriptions based on user prompts
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { guardSection } from "@/lib/admin/section-route-guard";

interface AIConfig {
  apiKey: string | null;
  model: string;
  enabled: boolean;
}

async function getAIConfig(): Promise<AIConfig> {
  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne();
    if (settings) {
      return {
        apiKey: settings.openaiApiKey || null,
        model: settings.openaiModel || "gpt-4o-mini",
        enabled: settings.openaiEnabled ?? false,
      };
    }
  } catch (error) {
    console.log("ℹ️ AI config not found in database, checking environment");
  }

  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled: process.env.OPENAI_ENABLED === "true",
  };
}

export async function POST(request: NextRequest) {
  /*
    Guarded 8 September 2026. This route, and the four beside it under `app/api/ai/`, had no
    authorization of ANY kind - not a weak check, none - and the admin app has no middleware,
    so anything able to reach the origin could post an arbitrary prompt and have it answered
    with the platform's own OpenAI key. That is a spending route as much as a content one: an
    unbounded model proxy on our account, with the prompt fully caller-controlled.

    Found by counting exported handlers against guards rather than by reading the files, which
    is the only method that finds these - every other route in the admin app has something, and
    that is precisely what sends a reader past the ones that have nothing. Same technique as
    R40's `finalize-old-competitions` and R47's `sync-referrals`.

    The section is the one owning the SCREEN that calls it, not a general "AI" grant: an
    operator trusted to write competition copy is not thereby trusted to rewrite the badge
    economy.
  */
  const guard = await guardSection("competitions");
  if (!guard.ok) return guard.response;

  try {
    const { prompt, type } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    const config = await getAIConfig();

    if (!config.enabled) {
      return NextResponse.json(
        {
          error:
            "AI features are disabled. Enable them in Environment Variables.",
        },
        { status: 400 },
      );
    }

    if (!config.apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key is not configured. Add it in Environment Variables.",
        },
        { status: 400 },
      );
    }

    const openai = new OpenAI({ apiKey: config.apiKey });

    const systemPrompt = `You are a creative marketing expert for a trading competition platform. 
Generate engaging, exciting competition content that attracts traders.

IMPORTANT RULES:
- Keep the title catchy, max 60 characters
- Keep the description concise, max 50 words
- Match the theme/style requested by the user
- Use exciting language that creates urgency and excitement
- Make it sound professional yet fun
- Include relevant emojis in the title if it fits the theme
- Focus on the competitive/gaming aspect`;

    const userPrompt =
      type === "title"
        ? `Generate ONLY a creative competition title based on this theme: "${prompt}"
Return ONLY the title, nothing else. No quotes.`
        : type === "description"
          ? `Generate ONLY a competition description (max 50 words) based on this theme: "${prompt}"
Return ONLY the description, nothing else. No quotes.`
          : `Generate a competition title and description based on this theme: "${prompt}"

Return JSON format ONLY:
{
  "title": "Creative competition title here",
  "description": "Engaging description here (max 50 words)"
}`;

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    const response = completion.choices[0]?.message?.content || "";

    if (type === "title") {
      return NextResponse.json({ title: response.trim() });
    } else if (type === "description") {
      return NextResponse.json({ description: response.trim() });
    } else {
      // Parse JSON for both
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          title: parsed.title?.trim() || "",
          description: parsed.description?.trim() || "",
        });
      }

      return NextResponse.json(
        {
          error: "Failed to parse AI response",
          raw: response,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI generation failed",
      },
      { status: 500 },
    );
  }
}
