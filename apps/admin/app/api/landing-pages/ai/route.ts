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
Each section object MUST have this exact structure:
{
  "id": "sec-{type}-{random4chars}",
  "type": "<section_type>",
  "order": <number>,
  "enabled": true,
  "content": { <content_fields> }
}

IMPORTANT: All content fields MUST be nested inside the "content" property. Never put content fields at the section root level.

Available section types and their "content" fields:
1. type "hero" → content: { "headline": "...", "subheadline": "...", "ctaText": "...", "ctaLink": "/register", "backgroundImage": "url", "backgroundGradient": "from-blue-900 to-purple-900", "badge": "🏆 #1 Platform" }
2. type "features" → content: { "headline": "...", "items": [{ "icon": "Zap", "title": "...", "description": "..." }] }  (icon values: Lucide names — Zap, Shield, Trophy, BarChart3, TrendingUp, Users, Globe, Rocket, Star, Heart, Target, Award, Clock, DollarSign, Lock, Sparkles)
3. type "stats" → content: { "title": "...", "items": [{ "value": "10K+", "label": "Active Traders", "icon": "Users" }] }
4. type "how-it-works" → content: { "headline": "...", "steps": [{ "step": "1", "title": "...", "description": "...", "icon": "UserPlus" }] }
5. type "testimonials" → content: { "headline": "...", "items": [{ "name": "...", "role": "Professional Trader", "quote": "...", "rating": 5 }] }
6. type "cta" → content: { "headline": "...", "subheadline": "...", "ctaText": "...", "ctaLink": "/register", "secondaryCtaText": "...", "secondaryCtaLink": "/about" }
7. type "faq" → content: { "title": "...", "items": [{ "question": "...", "answer": "..." }] }
8. type "custom-html" → content: { "html": "<div>...</div>" }

Example of a correct section:
{
  "id": "sec-hero-a1b2",
  "type": "hero",
  "order": 0,
  "enabled": true,
  "content": {
    "headline": "Trade. Compete. Win Real Prizes.",
    "subheadline": "Join thousands of traders competing with virtual funds for real cash prizes.",
    "ctaText": "Start Trading Now",
    "ctaLink": "/register",
    "backgroundGradient": "from-indigo-900 via-purple-900 to-slate-900",
    "badge": "🏆 Over $1M in Prizes Awarded"
  }
}
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
- If Pexels images are available, use them for hero backgroundImage fields inside content.
- Each section MUST have a unique "id" field (use format "sec-{type}-{random4chars}").
- ALL content fields MUST be inside the "content" object — never at the section root.
- Return a JSON object with a "sections" key containing an array of section objects: { "sections": [...] }
- No markdown fences, no explanation — ONLY the JSON object.${imageList}`;
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
- If Pexels images are available, use them for hero backgroundImage inside content.
- ALL content fields MUST be inside the "content" object — never at the section root.
- Set "order" sequentially starting from 0.
- Set "enabled" to true for all sections.
- Return a JSON object with a "sections" key containing an array of section objects: { "sections": [...] }
- No markdown fences, no explanation — ONLY the JSON object.
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

    const raw = completion.choices[0]?.message?.content || "{}";

    console.log("🤖 AI raw response length:", raw.length, "chars");

    // ── Parse response ────────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Reason: Sometimes the model wraps in markdown code fences
      const cleaned = raw.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error("❌ AI response parse failed. Raw:", raw.slice(0, 500));
        return NextResponse.json(
          { error: "AI returned invalid JSON. Please try again." },
          { status: 500 },
        );
      }
    }

    // Normalize — the model might return { sections: [...] }, { data: [...] }, or just [...]
    let rawSections: unknown[];
    if (Array.isArray(parsed)) {
      rawSections = parsed;
    } else if (parsed && typeof parsed === "object") {
      // Reason: Try common wrapper keys the model might use
      const obj = parsed as Record<string, unknown>;
      const arrayKey = ["sections", "data", "result", "pages", "landing_page", "content"].find(
        (k) => Array.isArray(obj[k]), // eslint-disable-line security/detect-object-injection
      );
      if (arrayKey) {
        rawSections = obj[arrayKey] as unknown[]; // eslint-disable-line security/detect-object-injection
      } else {
        // Last resort: check if all values are arrays and pick the first one
        const firstArr = Object.values(obj).find((v) => Array.isArray(v));
        if (firstArr) {
          rawSections = firstArr as unknown[];
        } else {
          console.error("❌ AI returned unexpected structure:", JSON.stringify(parsed).slice(0, 500));
          return NextResponse.json(
            { error: "AI returned an unexpected format. Please try again." },
            { status: 500 },
          );
        }
      }
    } else {
      console.error("❌ AI returned non-object:", typeof parsed);
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 500 },
      );
    }

    // Reason: Known structural fields that belong at section level, not inside content.
    const SECTION_META_KEYS = new Set(["id", "type", "order", "enabled", "content"]);

    // Validate, normalize, and sanitize sections
    let resultSections: LPSection[] = rawSections
      .filter((s): s is Record<string, unknown> => s != null && typeof s === "object" && !Array.isArray(s))
      .filter((s) => typeof s.type === "string" && s.type.length > 0)
      .map((s, i) => {
        // Reason: If the AI put content fields at the section root instead of nesting
        // them inside "content", we extract them automatically.
        let content: Record<string, unknown>;
        if (s.content && typeof s.content === "object" && !Array.isArray(s.content)) {
          content = s.content as Record<string, unknown>;
        } else {
          // Extract all non-meta keys as content fields
          content = {};
          for (const [k, v] of Object.entries(s)) {
            if (!SECTION_META_KEYS.has(k)) {
              content[k] = v; // eslint-disable-line security/detect-object-injection
            }
          }
        }

        return {
          id: (typeof s.id === "string" ? s.id : "") || `sec-${s.type}-${Math.random().toString(36).slice(2, 6)}`,
          type: s.type as string,
          order: i,
          enabled: s.enabled !== false,
          content,
        };
      });

    // Filter out sections that ended up with truly empty content
    resultSections = resultSections.filter(
      (s) => Object.keys(s.content).length > 0,
    );

    console.log(`🤖 AI parsed ${resultSections.length} sections from response`);

    if (resultSections.length === 0) {
      console.error("❌ AI sections empty after parsing. Raw:", raw.slice(0, 1000));
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
