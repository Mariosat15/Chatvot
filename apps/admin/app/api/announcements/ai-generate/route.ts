import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { requireAdminAuth } from "@/lib/admin/auth";

export const maxDuration = 30;

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
  } catch {
    // Fall through to env vars
  }
  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled: process.env.OPENAI_ENABLED === "true",
  };
}

const SYSTEM_PROMPT = `You are an assistant that writes clear, professional system announcements for a trading platform called ChartVolt.

Rules:
- Keep messages concise (1-3 sentences)
- Be professional but friendly
- Do not use excessive exclamation marks
- Include relevant details (time frames, actions to take)
- Match the tone to the announcement type:
  - maintenance: calm, informative, apologetic
  - critical: urgent but reassuring
  - warning: cautious, action-oriented
  - info: neutral, informative
  - update: positive, exciting
  - promotion: enthusiastic, engaging

Return ONLY valid JSON with "title" and "message" fields. No markdown, no code fences.`;

export async function POST(req: NextRequest) {
  try {
    await requireAdminAuth();

    const { action, prompt, currentTitle, currentMessage, type = "info" } =
      await req.json();

    const config = await getAIConfig();

    if (!config.apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add an OpenAI API key in Settings." },
        { status: 400 },
      );
    }

    const openai = new OpenAI({ apiKey: config.apiKey });

    let userPrompt: string;

    if (action === "generate") {
      userPrompt = `Generate a ${type} announcement for a trading platform.${prompt ? ` Context: ${prompt}` : ""}\n\nReturn JSON: {"title": "...", "message": "..."}`;
    } else if (action === "improve") {
      userPrompt = `Improve this ${type} announcement. Make it clearer and more professional.\n\nCurrent title: ${currentTitle}\nCurrent message: ${currentMessage}\n\nReturn JSON: {"title": "...", "message": "..."}`;
    } else if (action === "translate") {
      userPrompt = `Translate this announcement to English (keep professional tone):\n\nTitle: ${currentTitle}\nMessage: ${currentMessage}\n\nReturn JSON: {"title": "...", "message": "..."}`;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const raw = completion.choices[0]?.message?.content || "";
    // Reason: AI may wrap response in markdown code fences
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    const result = JSON.parse(cleaned);

    return NextResponse.json({
      success: true,
      title: result.title,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("AI generate announcement error:", error);
    return NextResponse.json(
      { error: "Failed to generate announcement" },
      { status: 500 },
    );
  }
}
