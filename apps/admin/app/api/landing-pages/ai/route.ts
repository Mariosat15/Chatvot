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
        openaiKey:
          (s.openaiApiKey as string) ||
          process.env.OPENAI_API_KEY ||
          null,
        openaiModel:
          (s.openaiModel as string) ||
          process.env.OPENAI_MODEL ||
          "gpt-4o-mini",
        openaiEnabled:
          (s.openaiEnabled as boolean) ??
          process.env.OPENAI_ENABLED === "true",
        pexelsKey:
          (s.pexelsApiKey as string) ||
          process.env.PEXELS_API_KEY ||
          null,
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
  count = 8,
): Promise<PexelsPhoto[]> {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`⚠️ Pexels search failed for "${query}": ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.photos || []) as PexelsPhoto[];
  } catch {
    return [];
  }
}

/**
 * Fetches images from multiple Pexels queries to give the AI rich visual variety.
 * Deduplicates by photo ID.
 */
async function fetchMultiplePexelsQueries(
  apiKey: string,
  queries: string[],
  perQuery = 5,
): Promise<PexelsPhoto[]> {
  const results = await Promise.all(
    queries.map((q) => searchPexels(apiKey, q, perQuery)),
  );
  const seen = new Set<number>();
  const deduped: PexelsPhoto[] = [];
  for (const batch of results) {
    for (const photo of batch) {
      if (!seen.has(photo.id)) {
        seen.add(photo.id);
        deduped.push(photo);
      }
    }
  }
  return deduped;
}

// ─── Image List Formatter ────────────────────────────────────────────────────

function formatImageList(photos: PexelsPhoto[]): string {
  if (photos.length === 0) return "";
  // Reason: Categorize images to help the AI pick the right one per section.
  const lines = photos.map(
    (p, i) =>
      `  IMG_${i + 1}: "${p.src.large}" — ${p.alt || "professional stock photo"} (${p.width}×${p.height}, by ${p.photographer})`,
  );

  return `

AVAILABLE PEXELS IMAGES — You MUST use these real image URLs in your sections:
${lines.join("\n")}

IMAGE PLACEMENT RULES:
- Hero section: Set "backgroundImage" to one of the above URLs (pick the most dramatic/relevant one).
- Features section: You may add an "image" field to any feature item for visual richness.
- CTA section: You may add a "backgroundImage" field for a compelling visual.
- Stats section: You may add a "backgroundImage" for visual impact.
- Pick different images for different sections — do NOT reuse the same image.
- Always use the FULL URL exactly as shown (starting with https://images.pexels.com/).`;
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

CRITICAL: All content fields MUST be nested inside the "content" property. Never put content fields at the section root level.

Available section types and their "content" fields:

1. type "hero" → content: {
     "headline": "Power words, benefit-driven, max 8 words",
     "subheadline": "2-3 sentences expanding the value proposition with specific details",
     "ctaText": "Action verb + benefit (e.g., Start Winning Today)",
     "ctaLink": "/register",
     "backgroundImage": "USE A PEXELS IMAGE URL HERE",
     "backgroundGradient": "from-indigo-900 via-purple-900 to-slate-900",
     "badge": "🏆 Social proof badge text"
   }

2. type "features" → content: {
     "headline": "Section headline",
     "items": [
       { "icon": "Zap", "title": "Feature name", "description": "2-3 sentences of compelling benefit-driven copy" }
     ]
   }
   Valid icon values: Zap, Shield, Trophy, BarChart3, TrendingUp, Users, Globe, Rocket, Star, Heart, Target, Award, Clock, DollarSign, Lock, Sparkles, Crown, Flame, Gift, Medal

3. type "stats" → content: {
     "title": "Section headline",
     "items": [
       { "value": "$2.5M+", "label": "Total Prizes Awarded", "icon": "DollarSign" }
     ]
   }
   Use 3-4 impressive but believable stats with specific numbers.

4. type "how-it-works" → content: {
     "headline": "Section headline",
     "steps": [
       { "step": "1", "title": "Step name", "description": "Clear, specific instructions", "icon": "UserPlus" }
     ]
   }
   Use exactly 3-4 steps. Keep them simple and actionable.

5. type "testimonials" → content: {
     "headline": "Section headline",
     "items": [
       { "name": "Full Name", "role": "Professional Trader, London", "quote": "Specific, authentic-sounding testimonial with concrete details about their experience", "rating": 5 }
     ]
   }
   Create 3-4 diverse testimonials with different backgrounds, locations, and experiences.

6. type "cta" → content: {
     "headline": "Urgency-driven headline",
     "subheadline": "Reinforce the value proposition one final time",
     "ctaText": "Strong action CTA",
     "ctaLink": "/register",
     "backgroundImage": "USE A DIFFERENT PEXELS IMAGE URL HERE",
     "secondaryCtaText": "Learn More",
     "secondaryCtaLink": "/about"
   }

7. type "faq" → content: {
     "title": "Section headline",
     "items": [
       { "question": "Common question?", "answer": "Thorough but concise answer (2-3 sentences)" }
     ]
   }
   Include 4-6 FAQs covering: how it works, safety, prizes, eligibility, getting started.

8. type "custom-html" → content: { "html": "<div>...</div>" }

FULL CORRECT EXAMPLE:
{
  "id": "sec-hero-x7k2",
  "type": "hero",
  "order": 0,
  "enabled": true,
  "content": {
    "headline": "Trade. Compete. Win Real Prizes.",
    "subheadline": "Join 10,000+ traders competing with virtual funds for real cash prizes up to $50,000. Zero risk, maximum thrill.",
    "ctaText": "Start Trading Now — It's Free",
    "ctaLink": "/register",
    "backgroundImage": "https://images.pexels.com/photos/example/pexels-photo.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "backgroundGradient": "from-slate-950 via-indigo-950 to-purple-950",
    "badge": "🏆 Over $2.5M in Prizes Awarded"
  }
}
`;

function getEnhanceSystemPrompt(imageList: string): string {
  return `You are a world-class landing page copywriter and conversion rate optimization expert. Your job is to DRAMATICALLY ENHANCE an existing landing page template to make it professional, compelling, and high-converting.

${SECTION_TYPES_DOC}
${imageList}

ENHANCEMENT RULES:
1. Keep the same section types and order, but COMPLETELY rewrite all copy to be professional-grade.
2. Headlines: Use power words, emotional triggers, and specific numbers. Max 6-10 words.
3. Subheadlines: Expand on the benefit with specifics — mention prize amounts, user counts, success rates.
4. CTA buttons: Action verb + clear benefit + urgency (e.g., "Claim Your Free Spot Now", "Start Winning Today").
5. Testimonials: Make them sound REAL with specific details — mention trading pairs, profit amounts, competition names.
6. Stats: Use impressive specific numbers (not round numbers — "$2.47M" feels more real than "$2.5M").
7. FAQ answers: Be thorough, professional, and reassuring.
8. Badge text: Social proof with specific numbers (e.g., "🏆 Trusted by 12,847 Traders Worldwide").
9. Gradient backgrounds: Use rich, professional gradients (from-slate-950 via-indigo-950 to-purple-950).
10. ALWAYS use Pexels image URLs for backgroundImage in hero and CTA sections.
11. Each section MUST have a unique "id" (format: "sec-{type}-{random4chars}").
12. ALL content fields MUST be inside the "content" object.
13. Return a JSON object: { "sections": [...] }
14. NO markdown, NO explanation — ONLY the JSON object.`;
}

function getGenerateSystemPrompt(imageList: string): string {
  return `You are a world-class landing page designer, copywriter, and conversion rate optimization expert. Create a STUNNING, high-converting landing page from scratch.

The platform is a trading competition platform where users trade with virtual funds and compete for real prizes.

${SECTION_TYPES_DOC}
${imageList}

GENERATION RULES:
1. Create exactly 7 sections in this order: hero, features, stats, how-it-works, testimonials, faq, cta.
2. Hero section MUST have a backgroundImage from Pexels AND a gradient overlay.
3. Write EXCEPTIONAL copy — this should read like it was written by a top marketing agency:
   - Headlines: Punchy, benefit-driven, emotionally compelling, 6-10 words max.
   - Subheadlines: Expand on value with SPECIFIC numbers and details.
   - CTA text: Action verb + benefit + urgency ("Start Winning Today — It's Free").
   - Badge: Social proof ("🏆 Trusted by 12,847 Traders" or "⚡ $2.47M in Prizes Awarded").
4. Features: Create 4-6 features with DIFFERENT Lucide icons. Each description should be 2-3 compelling sentences.
5. Stats: 4 impressive stats with SPECIFIC numbers (not round numbers — specificity = credibility).
6. How it works: Exactly 3-4 clear steps that make signing up feel easy and exciting.
7. Testimonials: 3-4 DIVERSE, authentic-sounding testimonials:
   - Different names, roles, and locations
   - Mention specific details (trading pairs, amounts won, time on platform)
   - Ratings of 4-5 stars
8. FAQ: 5-6 questions covering common objections (cost, safety, how prizes work, eligibility).
9. CTA: Strong closing section with urgency, a backgroundImage, and both primary + secondary CTA.
10. Use Pexels images: hero backgroundImage and CTA backgroundImage should use DIFFERENT Pexels URLs.
11. Use rich gradient backgrounds: from-slate-950, via-indigo-950, to-purple-950 (or similar dark professional gradients).
12. Each section MUST have a unique "id" (format: "sec-{type}-{random4chars}").
13. ALL content fields MUST be inside "content".
14. Set "order" sequentially from 0.
15. Set "enabled" to true for all sections.
16. Return a JSON object: { "sections": [...] }
17. NO markdown, NO explanation — ONLY the JSON object.`;
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

    if (
      !instructions ||
      typeof instructions !== "string" ||
      instructions.trim().length < 3
    ) {
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
        {
          error:
            "AI features are disabled. Enable them in Settings → Environment → OpenAI.",
        },
        { status: 400 },
      );
    }

    if (!config.openaiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key is not configured. Add it in Settings → Environment → OpenAI.",
        },
        { status: 400 },
      );
    }

    // ── Fetch Pexels images with MULTIPLE queries for variety ─────────
    let pexelsPhotos: PexelsPhoto[] = [];
    if (config.pexelsKey) {
      // Reason: Multiple queries give the AI diverse images for different sections.
      const searchQueries = [
        imageQuery || "trading finance charts",
        "business success celebration",
        "technology dashboard futuristic",
      ];
      // If user provided custom instructions, extract a keyword-based query
      if (!imageQuery && instructions.length > 10) {
        searchQueries.push(instructions.slice(0, 60));
      }
      pexelsPhotos = await fetchMultiplePexelsQueries(
        config.pexelsKey,
        searchQueries,
        5,
      );
      console.log(
        `📸 Fetched ${pexelsPhotos.length} Pexels images from ${searchQueries.length} queries`,
      );
    } else {
      console.warn(
        "⚠️ No Pexels API key — AI will generate without images",
      );
    }

    // ── Build prompt ──────────────────────────────────────────────────
    const imageList = formatImageList(pexelsPhotos);
    const systemPrompt =
      mode === "enhance"
        ? getEnhanceSystemPrompt(imageList)
        : getGenerateSystemPrompt(imageList);

    let userPrompt: string;
    if (mode === "enhance") {
      userPrompt = `Here are the current sections of my landing page:\n\n${JSON.stringify(sections, null, 2)}\n\nMy instructions for improvement:\n${instructions}`;
    } else {
      userPrompt = `Create a professional, high-converting landing page with these requirements:\n\n${instructions}\n\nRemember: Use the Pexels image URLs provided in your system prompt for backgroundImage fields. Make the copy exceptional — this should look like a page from a top-tier SaaS company.`;
    }

    // ── Call OpenAI ───────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey: config.openaiKey });

    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";

    console.log("🤖 AI raw response length:", raw.length, "chars");

    // ── Parse response ────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Reason: Sometimes the model wraps in markdown code fences
      const cleaned = raw
        .replace(/```json?\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error(
          "❌ AI response parse failed. Raw:",
          raw.slice(0, 500),
        );
        return NextResponse.json(
          { error: "AI returned invalid JSON. Please try again." },
          { status: 500 },
        );
      }
    }

    // Normalize — the model might return { sections: [...] } or other wrappers
    let rawSections: unknown[];
    if (Array.isArray(parsed)) {
      rawSections = parsed;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      // Reason: Try common wrapper keys the model might use
      const wrapperKeys = [
        "sections",
        "data",
        "result",
        "pages",
        "landing_page",
        "content",
      ];
      const arrayKey = wrapperKeys.find((k) =>
        Array.isArray(obj[k]), // eslint-disable-line security/detect-object-injection
      );
      if (arrayKey) {
        rawSections = obj[arrayKey] as unknown[]; // eslint-disable-line security/detect-object-injection
      } else {
        // Last resort: pick the first array value
        const firstArr = Object.values(obj).find((v) => Array.isArray(v));
        if (firstArr) {
          rawSections = firstArr as unknown[];
        } else {
          console.error(
            "❌ AI returned unexpected structure:",
            JSON.stringify(parsed).slice(0, 500),
          );
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
    const SECTION_META_KEYS = new Set([
      "id",
      "type",
      "order",
      "enabled",
      "content",
    ]);

    // Validate, normalize, and sanitize sections
    let resultSections: LPSection[] = rawSections
      .filter(
        (s): s is Record<string, unknown> =>
          s != null && typeof s === "object" && !Array.isArray(s),
      )
      .filter((s) => typeof s.type === "string" && s.type.length > 0)
      .map((s, i) => {
        // Reason: If the AI put content fields at the section root instead of nesting
        // them inside "content", we extract them automatically.
        let content: Record<string, unknown>;
        if (
          s.content &&
          typeof s.content === "object" &&
          !Array.isArray(s.content)
        ) {
          content = s.content as Record<string, unknown>;
        } else {
          content = {};
          for (const [k, v] of Object.entries(s)) {
            if (!SECTION_META_KEYS.has(k)) {
              content[k] = v; // eslint-disable-line security/detect-object-injection
            }
          }
        }

        return {
          id:
            (typeof s.id === "string" ? s.id : "") ||
            `sec-${s.type}-${Math.random().toString(36).slice(2, 6)}`,
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

    console.log(
      `🤖 AI parsed ${resultSections.length} sections from response`,
    );

    if (resultSections.length === 0) {
      console.error(
        "❌ AI sections empty after parsing. Raw:",
        raw.slice(0, 1000),
      );
      return NextResponse.json(
        {
          error:
            "AI generated empty content. Please try with different instructions.",
        },
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
        {
          error:
            "Invalid OpenAI API key. Please check your configuration.",
        },
        { status: 401 },
      );
    }
    if (errMsg.includes("429") || errMsg.includes("Rate limit")) {
      return NextResponse.json(
        {
          error:
            "AI rate limit reached. Please wait a moment and try again.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Failed to generate content. Please try again." },
      { status: 500 },
    );
  }
}
