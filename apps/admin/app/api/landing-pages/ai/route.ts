/**
 * AI Landing Page Generator API
 *
 * Two modes:
 * 1. "enhance" — Improve an existing template's sections with professional copy + Pexels images
 * 2. "generate" — Create a brand-new landing page from scratch based on user instructions
 *
 * Uses OpenAI (configurable model) + Pexels API for images.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIConfig {
  openaiKey: string | null;
  openaiModel: string;
  openaiEnabled: boolean;
  pexelsKey: string | null;
}

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  src: { original: string; large2x: string; large: string; medium: string };
  alt: string;
}

interface LPSection {
  id: string;
  type: string;
  order: number;
  enabled: boolean;
  content: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAIConfig(): Promise<AIConfig> {
  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne()
      .select("openaiApiKey openaiModel openaiEnabled pexelsApiKey")
      .lean();

    if (settings) {
      const s = settings as Record<string, unknown>;
      return {
        openaiKey: (s.openaiApiKey as string) || process.env.OPENAI_API_KEY || null,
        openaiModel: (s.openaiModel as string) || process.env.OPENAI_MODEL || "gpt-4o-mini",
        openaiEnabled: (s.openaiEnabled as boolean) ?? process.env.OPENAI_ENABLED === "true",
        pexelsKey: (s.pexelsApiKey as string) || process.env.PEXELS_API_KEY || null,
      };
    }
  } catch {
    console.warn("⚠️ AI config not in DB, falling back to env");
  }

  return {
    openaiKey: process.env.OPENAI_API_KEY || null,
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    openaiEnabled: process.env.OPENAI_ENABLED === "true",
    pexelsKey: process.env.PEXELS_API_KEY || null,
  };
}

async function searchPexels(
  apiKey: string,
  query: string,
  count = 5,
): Promise<PexelsPhoto[]> {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []) as PexelsPhoto[];
  } catch {
    return [];
  }
}

// ─── System Prompts ──────────────────────────────────────────────────────────

const SECTION_TYPES_DOC = `
Available section types and their content structure:
1. "hero" — { headline, subheadline, ctaText, ctaLink, backgroundImage?, backgroundGradient?, badge? }
2. "features" — { headline?, title?, items: [{ icon, title, description }] } (icons: Lucide names like "Zap", "Shield", "Trophy", "BarChart3", "TrendingUp", "Users", "Globe", "Rocket", "Star", "Heart", "Target", "Award")
3. "stats" — { title?, items: [{ value, label, icon? }] }
4. "how-it-works" — { headline?, title?, steps: [{ step, title, description, icon? }] }
5. "testimonials" — { headline?, title?, items: [{ name, role?, quote, rating? }] }
6. "cta" — { headline, subheadline?, ctaText, ctaLink, secondaryCtaText?, secondaryCtaLink? }
7. "faq" — { title?, items: [{ question, answer }] }
8. "custom-html" — { html: "string" }
`;

function getEnhanceSystemPrompt(pexelsImages: PexelsPhoto[]): string {
  const imageList = pexelsImages.length
    ? `\n\nAvailable Pexels images you can use (use the "large" URL):\n${pexelsImages.map((p, i) => `  ${i + 1}. "${p.src.large}" — ${p.alt || "stock photo"} (by ${p.photographer})`).join("\n")}`
    : "";

  return `You are a professional landing page copywriter and UX designer. Your job is to ENHANCE an existing landing page template to make it more professional, compelling, and conversion-optimized.

${SECTION_TYPES_DOC}

Rules:
- Keep the same section structure (types and order) but dramatically improve the content.
- Write professional, persuasive marketing copy. Use power words, social proof, urgency.
- Make headlines punchy and benefit-driven. Subheadlines should expand on the value proposition.
- CTA buttons should use action-oriented text (e.g., "Start Winning Today", "Claim Your Spot").
- Testimonials should sound authentic with specific details.
- FAQ answers should be thorough but concise.
- Stats should use impressive but believable numbers.
- If Pexels images are available, use them for hero backgroundImage fields.
- Each section MUST have a unique "id" field (use format "sec-{type}-{random4chars}").
- Return ONLY valid JSON — an array of section objects. No markdown, no explanation.${imageList}`;
}

function getGenerateSystemPrompt(pexelsImages: PexelsPhoto[]): string {
  const imageList = pexelsImages.length
    ? `\n\nAvailable Pexels images you can use (use the "large" URL):\n${pexelsImages.map((p, i) => `  ${i + 1}. "${p.src.large}" — ${p.alt || "stock photo"} (by ${p.photographer})`).join("\n")}`
    : "";

  return `You are a professional landing page designer and copywriter. Your job is to CREATE a brand-new, high-converting landing page from scratch based on user instructions.

${SECTION_TYPES_DOC}

Rules:
- Create 5-8 sections for a complete, professional landing page.
- Always start with a "hero" section and end with a "cta" section.
- Include at least: hero, features (or stats), how-it-works, testimonials, cta.
- Write professional, persuasive marketing copy focused on conversion.
- Headlines must be punchy, benefit-driven, and emotionally compelling.
- Use specific numbers and details (not vague claims).
- CTA buttons should create urgency ("Start Now", "Join 10,000+ Traders", "Get Started Free").
- If Pexels images are available, use them for hero backgroundImage.
- Each section MUST have a unique "id" field (use format "sec-{type}-{random4chars}").
- Set "order" sequentially starting from 0.
- Set "enabled" to true for all sections.
- Return ONLY valid JSON — an array of section objects. No markdown, no explanation.
- The landing page is for a trading competition platform where users trade with virtual funds and compete for real prizes.${imageList}`;
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, instructions, sections, imageQuery } = body as {
      mode: "enhance" | "generate";
      instructions: string;
      sections?: LPSection[];
      imageQuery?: string;
    };

    if (!mode || !["enhance", "generate"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Use 'enhance' or 'generate'." },
        { status: 400 },
      );
    }

    if (!instructions || typeof instructions !== "string" || instructions.trim().length < 3) {
      return NextResponse.json(
        { error: "Please provide instructions (at least 3 characters)." },
        { status: 400 },
      );
    }

    if (mode === "enhance" && (!sections || sections.length === 0)) {
      return NextResponse.json(
        { error: "Sections are required for enhance mode." },
        { status: 400 },
      );
    }

    const config = await getAIConfig();

    if (!config.openaiEnabled) {
      return NextResponse.json(
        { error: "AI features are disabled. Enable them in Settings → Environment → OpenAI." },
        { status: 400 },
      );
    }

    if (!config.openaiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Add it in Settings → Environment → OpenAI." },
        { status: 400 },
      );
    }

    // ── Fetch Pexels images for context ───────────────────────────────────
    let pexelsPhotos: PexelsPhoto[] = [];
    const pexelsQuery =
      imageQuery ||
      (mode === "enhance"
        ? "trading finance competition"
        : instructions.slice(0, 80));

    if (config.pexelsKey) {
      pexelsPhotos = await searchPexels(config.pexelsKey, pexelsQuery, 6);
    }

    // ── Build prompt ──────────────────────────────────────────────────────
    const systemPrompt =
      mode === "enhance"
        ? getEnhanceSystemPrompt(pexelsPhotos)
        : getGenerateSystemPrompt(pexelsPhotos);

    let userPrompt: string;
    if (mode === "enhance") {
      userPrompt = `Here are the current sections of my landing page:\n\n${JSON.stringify(sections, null, 2)}\n\nMy instructions for improvement:\n${instructions}`;
    } else {
      userPrompt = `Create a professional landing page with these requirements:\n${instructions}`;
    }

    // ── Call OpenAI ───────────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey: config.openaiKey });

    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "[]";

    // ── Parse response ────────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Reason: Sometimes the model wraps in markdown code fences
      const cleaned = raw.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    // Normalize — the model might return { sections: [...] } or just [...]
    let resultSections: LPSection[];
    if (Array.isArray(parsed)) {
      resultSections = parsed;
    } else if (
      parsed &&
      typeof parsed === "object" &&
      "sections" in (parsed as Record<string, unknown>) &&
      Array.isArray((parsed as Record<string, unknown>).sections)
    ) {
      resultSections = (parsed as { sections: LPSection[] }).sections;
    } else {
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 500 },
      );
    }

    // Validate and sanitize sections
    resultSections = resultSections
      .filter((s) => s && typeof s === "object" && s.type && s.content)
      .map((s, i) => ({
        id: s.id || `sec-${s.type}-${Math.random().toString(36).slice(2, 6)}`,
        type: s.type,
        order: i,
        enabled: s.enabled !== false,
        content: s.content || {},
      }));

    if (resultSections.length === 0) {
      return NextResponse.json(
        { error: "AI generated empty content. Please try with different instructions." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      sections: resultSections,
      pexelsImages: pexelsPhotos.map((p) => ({
        id: p.id,
        url: p.src.large,
        photographer: p.photographer,
        alt: p.alt,
      })),
      usage: {
        model: config.openaiModel,
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
      },
    });
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error("❌ AI landing page error:", errMsg);

    // Reason: OpenAI-specific errors have a status property
    if (errMsg.includes("401") || errMsg.includes("Incorrect API key")) {
      return NextResponse.json(
        { error: "Invalid OpenAI API key. Please check your configuration." },
        { status: 401 },
      );
    }
    if (errMsg.includes("429") || errMsg.includes("Rate limit")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Please wait a moment and try again." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Failed to generate content. Please try again." },
      { status: 500 },
    );
  }
}
