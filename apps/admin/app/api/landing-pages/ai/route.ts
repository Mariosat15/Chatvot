/**
 * AI Landing Page Generator API — v2 (Design-Aware)
 *
 * Two modes:
 * 1. "enhance" — Improve an existing template with professional copy, theming, and images
 * 2. "generate" — Create a brand-new, visually unique landing page from scratch
 *
 * Key improvement over v1: The AI now controls per-section styling via
 * content.style = { accentColor, bgGradient, bgImage, layout }
 * which the renderer uses for visual diversity.
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

// ─── Config ──────────────────────────────────────────────────────────────────

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

// ─── Pexels Helpers ──────────────────────────────────────────────────────────

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

async function fetchDiversePexelsImages(
  apiKey: string,
  queries: string[],
  perQuery = 6,
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

// ─── Image Catalogue for AI ─────────────────────────────────────────────────

function buildImageCatalogue(photos: PexelsPhoto[]): string {
  if (photos.length === 0) return "\n(No Pexels images available — skip backgroundImage fields.)\n";

  const lines = photos.map(
    (p, i) =>
      `  [IMG${i + 1}] ${p.src.large} — "${p.alt || "professional photo"}" (${p.width}×${p.height}, by ${p.photographer})`,
  );

  return `
═══════════════════════════════════════════════════════
PEXELS IMAGE CATALOGUE — Use these URLs in your output
═══════════════════════════════════════════════════════
${lines.join("\n")}

IMAGE USAGE RULES:
• You MUST use at least 4-6 different images across the page
• Hero section → "backgroundImage" = pick the most dramatic/cinematic image
• image-text sections → "image" = pick contextually relevant image
• banner section → "backgroundImage" = pick a wide, atmospheric image
• CTA section → "backgroundImage" = pick an inspiring/motivational image
• gallery items → "image" = one per item
• features items → "image" = optionally add to 1-2 feature cards
• NEVER reuse the same image URL twice on the same page
• ALWAYS copy the full URL exactly as shown (starting with https://images.pexels.com/)
═══════════════════════════════════════════════════════`;
}

// ─── Design System Documentation ────────────────────────────────────────────

const DESIGN_SYSTEM = `
═══════════════════════════════════════════════════════
DESIGN SYSTEM — Per-Section Visual Theming
═══════════════════════════════════════════════════════

Every section's "content" object can include a "style" sub-object that controls its visual appearance.
By using DIFFERENT style values across sections, you create a visually diverse, professional page.

"style" object properties:
{
  "accentColor": "blue" | "emerald" | "rose" | "violet" | "cyan" | "orange" | "teal" | "pink" | "indigo" | "yellow",
  "bgGradient": "from-slate-950 via-indigo-950 to-purple-950",
  "bgImage": "PEXELS_URL_HERE",
  "layout": "default" | "alternating" | "horizontal" | "reversed" | "cards" | "grid"
}

ACCENT COLORS — Pick a PRIMARY accent for the page, then vary per section:
• "blue" — Professional, trustworthy (finance, corporate)
• "emerald" — Growth, success, money (trading, profits)
• "violet" — Premium, exclusive (luxury, high-end)
• "cyan" — Tech, innovation, speed (fintech, cutting-edge)
• "rose" — Bold, exciting, competitive (competitions, gaming)
• "orange" — Energy, urgency, warmth (action, engagement)
• "teal" — Calm, sophisticated (analytics, data)
• "indigo" — Deep, authoritative (expertise, trust)
• "pink" — Creative, modern (trendy, social)
• "yellow" — Classic gold, traditional (wealth, prizes)

BACKGROUND GRADIENTS — Use Tailwind gradient syntax. Examples:
• "from-slate-950 via-indigo-950 to-blue-950" (deep blue corporate)
• "from-gray-950 via-emerald-950 to-teal-950" (dark green luxury)
• "from-purple-950 via-violet-950 to-indigo-950" (rich purple)
• "from-gray-950 via-rose-950 to-pink-950" (bold pink)
• "from-slate-950 via-cyan-950 to-sky-950" (tech cyan)
• "from-zinc-950 via-stone-900 to-gray-950" (neutral elegant)

LAYOUT VARIANTS by section type:
• features → "grid" (default cards) or "alternating" (image + text rows, best with images)
• how-it-works → "default" (vertical list) or "horizontal" (step cards in a row)
• testimonials → "grid" (3-col cards) or "cards" (2-col larger quote cards)
• image-text → "default" (image left, text right) or "reversed" (image right, text left)

DESIGN RULES:
1. NEVER use the same accentColor for all sections — vary it (e.g., hero=cyan, features=emerald, cta=violet)
2. NEVER use the same bgGradient for consecutive sections — alternate between light/dark
3. Use bgImage on at least 2-3 sections (hero, banner, CTA, image-text)
4. Alternate section backgrounds: dark gradient → image → neutral → colored → image → dark
5. Make the page feel like it was designed by a professional agency — not a template

═══════════════════════════════════════════════════════`;

// ─── Section Types Documentation ─────────────────────────────────────────────

const SECTION_TYPES_DOC = `
═══════════════════════════════════════════════════════
SECTION TYPES — Complete Reference
═══════════════════════════════════════════════════════

Every section MUST have this structure:
{
  "id": "sec-{type}-{random4chars}",
  "type": "<section_type>",
  "order": <sequential_number>,
  "enabled": true,
  "content": {
    "style": { "accentColor": "...", "bgGradient": "...", "bgImage": "...", "layout": "..." },
    ...content_fields
  }
}

CRITICAL: ALL content fields MUST be nested inside "content". NEVER put them at section root.

───────────────────────────────────────────────────────
1. type "hero" → Full-screen hero banner
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "cyan" },
  "headline": "Max 8 power words. Benefit-driven. Emotional.",
  "subheadline": "2-3 sentences expanding value with specific numbers and details.",
  "ctaText": "Action Verb + Benefit (e.g. Start Winning Today)",
  "ctaLink": "/register",
  "backgroundImage": "PEXELS_URL",
  "backgroundGradient": "from-slate-950 via-indigo-950 to-purple-950",
  "badge": "🏆 Social proof with specific number",
  "secondaryCtaText": "Learn More",
  "secondaryCtaLink": "/about"
}

───────────────────────────────────────────────────────
2. type "features" → Feature grid or alternating rows
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "emerald", "layout": "grid" | "alternating" },
  "headline": "Section headline",
  "subtitle": "Optional subtitle paragraph",
  "items": [
    { "icon": "Zap", "title": "Feature name", "description": "2-3 compelling sentences", "image": "OPTIONAL_PEXELS_URL" }
  ]
}
Icons: Zap, Shield, Trophy, BarChart3, TrendingUp, Users, Globe, Rocket, Star, Heart, Target, Award, Clock, DollarSign, Lock, Sparkles, Crown, Flame, Gift, Medal, Brain, Lightbulb, Gauge, Gem, Eye

───────────────────────────────────────────────────────
3. type "stats" → Impressive numbers grid
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "violet", "bgGradient": "from-slate-950 via-violet-950 to-indigo-950" },
  "title": "Section headline",
  "subtitle": "Optional subtitle",
  "items": [
    { "value": "$2.47M+", "label": "Total Prizes Awarded", "icon": "DollarSign" }
  ]
}
Use 3-4 stats with SPECIFIC non-round numbers for credibility.

───────────────────────────────────────────────────────
4. type "how-it-works" → Step-by-step process
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "blue", "layout": "default" | "horizontal" },
  "headline": "Section headline",
  "subtitle": "Optional subtitle",
  "steps": [
    { "step": "1", "title": "Step name", "description": "Clear instructions", "icon": "UserPlus" }
  ]
}
Use exactly 3-4 steps.

───────────────────────────────────────────────────────
5. type "testimonials" → Social proof quotes
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "rose", "layout": "grid" | "cards" },
  "headline": "Section headline",
  "subtitle": "Optional subtitle",
  "items": [
    { "name": "Full Name", "role": "Professional Trader, London", "quote": "Specific, authentic testimonial with concrete details", "rating": 5 }
  ]
}
3-4 diverse testimonials. Different names, locations, trading styles.

───────────────────────────────────────────────────────
6. type "cta" → Final call-to-action
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "orange" },
  "headline": "Urgency-driven headline",
  "subheadline": "Reinforce the value one final time",
  "ctaText": "Strong action CTA",
  "ctaLink": "/register",
  "backgroundImage": "PEXELS_URL",
  "secondaryCtaText": "Learn More",
  "secondaryCtaLink": "/about"
}

───────────────────────────────────────────────────────
7. type "faq" → Expandable FAQ
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "teal" },
  "title": "Section headline",
  "subtitle": "Optional subtitle",
  "items": [
    { "question": "Common question?", "answer": "Thorough 2-3 sentence answer" }
  ]
}
5-6 FAQs covering: how it works, safety, prizes, eligibility, getting started, cost.

───────────────────────────────────────────────────────
8. type "image-text" → Split layout (image + text side by side)
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "emerald", "layout": "default" | "reversed" },
  "headline": "Section headline",
  "subtitle": "Optional eyebrow text above headline",
  "description": "1-2 paragraphs of compelling copy",
  "image": "PEXELS_URL",
  "bullets": ["Benefit point one", "Benefit point two", "Benefit point three"],
  "ctaText": "Optional CTA button text",
  "ctaLink": "/register"
}

───────────────────────────────────────────────────────
9. type "banner" → Full-width image banner with text overlay
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "violet" },
  "headline": "Bold statement headline",
  "subtitle": "Supporting text",
  "backgroundImage": "PEXELS_URL",
  "ctaText": "Optional CTA",
  "ctaLink": "/register"
}

───────────────────────────────────────────────────────
10. type "gallery" → Image showcase grid
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "cyan" },
  "headline": "Section headline",
  "subtitle": "Optional subtitle",
  "items": [
    { "image": "PEXELS_URL", "title": "Caption", "description": "Optional description" }
  ]
}
Use 3-6 items.

───────────────────────────────────────────────────────
11. type "custom-html" → Raw HTML (use sparingly)
───────────────────────────────────────────────────────
content: { "html": "<div>...</div>" }

═══════════════════════════════════════════════════════`;

// ─── System Prompts ──────────────────────────────────────────────────────────

function getEnhanceSystemPrompt(imageCatalogue: string): string {
  return `You are a world-class landing page designer and conversion rate optimizer with 15 years of experience at top agencies like Pentagram, IDEO, and Huge. Your specialty is transforming basic templates into stunning, high-converting pages.

${DESIGN_SYSTEM}

${SECTION_TYPES_DOC}

${imageCatalogue}

YOUR ENHANCEMENT MISSION:
You will receive an existing landing page template. Your job is to DRAMATICALLY transform it — not just edit text, but redesign the entire visual experience.

ENHANCEMENT STRATEGY:
1. KEEP the same section types but COMPLETELY reimagine the visual design
2. Assign DIFFERENT accentColors to different sections (e.g., hero=cyan, features=emerald, stats=violet, cta=orange)
3. Add "style" objects to EVERY section with varied bgGradient, accentColor, and layout values
4. ADD 1-2 new sections if they would improve the page (image-text, banner, gallery)
5. REWRITE ALL COPY to be world-class:
   - Headlines: Power words, emotional triggers, specific numbers. Max 8 words.
   - Subheadlines: Expand with specifics — prize amounts, user counts, success rates
   - CTAs: Action verb + clear benefit + urgency
   - Testimonials: Real-sounding with specific details (trading pairs, amounts, timeframes)
   - Stats: Specific non-round numbers ("$2.47M" not "$2.5M", "12,847" not "13,000")
6. Use DIFFERENT Pexels images across multiple sections — hero, image-text, banner, CTA
7. Use DIFFERENT background gradients for consecutive sections — alternate light/dark
8. Use DIFFERENT layout variants where available (features: "alternating", testimonials: "cards", how-it-works: "horizontal")

CRITICAL: Return ONLY a JSON object: { "sections": [...] }
NO markdown. NO explanation. NO commentary. ONLY the JSON object.`;
}

function getGenerateSystemPrompt(imageCatalogue: string): string {
  return `You are a world-class landing page designer, copywriter, and conversion expert. You design pages that look like they belong to billion-dollar companies. Every page you create is unique, visually stunning, and converts visitors into users.

The platform is a TRADING COMPETITION platform where users trade with virtual funds and compete for real cash prizes.

${DESIGN_SYSTEM}

${SECTION_TYPES_DOC}

${imageCatalogue}

YOUR GENERATION MISSION:
Create a COMPLETELY UNIQUE, visually stunning landing page. Every page you create must feel different from the last — different colors, different layouts, different section combinations.

MANDATORY REQUIREMENTS:
1. Create 8-10 sections using a MIX of types — NOT just the basic 7. Include at least:
   - 1 hero section
   - 1-2 image-text sections (with real Pexels images)
   - 1 features section (with varied layout)
   - 1 stats section
   - 1 banner OR gallery section (with Pexels images)
   - 1 testimonials section
   - 1 faq section
   - 1 cta section

2. VISUAL DIVERSITY — every section must have a "style" object:
   - Use 3-4 DIFFERENT accentColors across the page
   - Alternate bgGradient between sections
   - Use bgImage (Pexels URLs) on at least 3 sections
   - Vary layouts: features→"alternating", how-it-works→"horizontal", testimonials→"cards"

3. WORLD-CLASS COPYWRITING:
   - Hero headline: 5-8 words. Punchy. Emotional. Benefit-driven.
     Examples: "Trade Boldly. Win Big." / "Where Skill Meets Reward" / "Your Edge in Every Market"
   - Subheadlines: Expand with SPECIFIC numbers and social proof
   - CTAs: "Start Winning Today — It's Free" / "Claim Your Spot Now" / "Join 12,847 Traders"
   - Badge: Always include social proof with specific numbers
   - Each section headline should be unique and compelling

4. AUTHENTIC TESTIMONIALS with specific details:
   - Different nationalities, trading styles, experience levels
   - Mention specific pairs (EUR/USD, BTC, Gold), amounts won, competition types
   - Mix of 4★ and 5★ ratings for authenticity

5. IMAGE USAGE — distribute Pexels images across:
   - Hero background, image-text sections, banner, CTA background, gallery items
   - Each image used ONCE — no repeats

6. Section order should FLOW like a story:
   hero → (image-text OR features) → stats → (banner OR image-text) → how-it-works → testimonials → faq → cta

CRITICAL: Return ONLY a JSON object: { "sections": [...] }
NO markdown. NO explanation. NO commentary. ONLY the JSON.`;
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

    // ── Fetch Pexels images with DIVERSE queries ──────────────────────
    let pexelsPhotos: PexelsPhoto[] = [];
    if (config.pexelsKey) {
      // Reason: 5+ queries with 6 images each gives ~25-30 diverse images for the AI to pick from
      const searchQueries = [
        "trading finance stock market charts",
        "business professionals success celebration",
        "technology data dashboard analytics",
        "competition trophy award winning",
        "city skyline night lights modern",
      ];
      if (imageQuery) {
        searchQueries.unshift(imageQuery);
      }
      if (instructions.length > 15) {
        // Extract keywords from user instructions for contextual images
        searchQueries.push(instructions.slice(0, 80));
      }

      pexelsPhotos = await fetchDiversePexelsImages(
        config.pexelsKey,
        searchQueries,
        6,
      );
      console.log(
        `📸 Fetched ${pexelsPhotos.length} Pexels images from ${searchQueries.length} queries`,
      );
    } else {
      console.warn("⚠️ No Pexels API key — AI will generate without images");
    }

    // ── Build prompt ──────────────────────────────────────────────────
    const imageCatalogue = buildImageCatalogue(pexelsPhotos);
    const systemPrompt =
      mode === "enhance"
        ? getEnhanceSystemPrompt(imageCatalogue)
        : getGenerateSystemPrompt(imageCatalogue);

    let userPrompt: string;
    if (mode === "enhance") {
      userPrompt = `EXISTING LANDING PAGE SECTIONS TO ENHANCE:\n\n${JSON.stringify(sections, null, 2)}\n\nMY INSTRUCTIONS:\n${instructions}\n\nRemember: Transform the VISUAL DESIGN, not just text. Add "style" objects with different accentColors, bgGradients, layouts. Use multiple Pexels images across different sections. Make it look like a $50,000 custom-designed page.`;
    } else {
      userPrompt = `CREATE A UNIQUE LANDING PAGE WITH THESE REQUIREMENTS:\n\n${instructions}\n\nRemember:\n- Use 8-10 sections with varied types (hero, image-text, features, stats, banner, testimonials, faq, cta)\n- Every section needs a "style" object with DIFFERENT accentColors and bgGradients\n- Use 4-6 different Pexels images from the catalogue across sections\n- Write world-class copy with specific numbers and social proof\n- Make it visually stunning — this should look like it was designed by a top agency`;
    }

    // ── Call OpenAI ───────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey: config.openaiKey });

    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 12000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";

    console.log(
      "🤖 AI raw response length:",
      raw.length,
      "chars | tokens:",
      completion.usage?.completion_tokens,
    );

    // ── Parse response ────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw
        .replace(/```json?\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
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

    // Normalize response structure
    let rawSections: unknown[];
    if (Array.isArray(parsed)) {
      rawSections = parsed;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const wrapperKeys = [
        "sections",
        "data",
        "result",
        "pages",
        "landing_page",
        "content",
      ];
      const arrayKey = wrapperKeys.find((k) => {
        const val = new Map(Object.entries(obj)).get(k);
        return Array.isArray(val);
      });
      if (arrayKey) {
        rawSections = new Map(Object.entries(obj)).get(arrayKey) as unknown[];
      } else {
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

    // Filter out sections with empty content
    resultSections = resultSections.filter(
      (s) => Object.keys(s.content).length > 0,
    );

    console.log(
      `🤖 AI produced ${resultSections.length} sections (types: ${resultSections.map((s) => s.type).join(", ")})`,
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
