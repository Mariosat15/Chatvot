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

// ─── Theme Keyword Extraction ────────────────────────────────────────────────
// Reason: Extract relevant image search terms from user instructions so Pexels
// results match the user's specific theme rather than generic trading images.

function extractThemeKeywords(instructions: string): string[] {
  const text = instructions.toLowerCase();
  const queries: string[] = [];

  // Theme-specific keyword clusters
  const themePatterns: Array<{ keywords: string[]; searches: string[] }> = [
    { keywords: ["radioactive", "fallout", "wasteland", "toxic", "nuclear"], searches: ["neon green cyberpunk dark city", "toxic green glowing abstract", "post apocalyptic wasteland dark"] },
    { keywords: ["ocean", "sea", "deep blue", "aquatic", "underwater", "marine"], searches: ["ocean deep blue underwater", "luxury yacht night ocean", "ocean waves aerial dark"] },
    { keywords: ["fire", "inferno", "flame", "blaze", "ember", "burn"], searches: ["fire flames dramatic dark", "red ember glowing abstract", "explosion fire energy dark"] },
    { keywords: ["neon", "synthwave", "cyberpunk", "retro", "tron", "80s"], searches: ["neon purple city night", "cyberpunk neon lights street", "retro synthwave abstract purple pink"] },
    { keywords: ["arctic", "frost", "ice", "snow", "winter", "mountain", "glacier"], searches: ["arctic ice mountain landscape", "frost crystal blue abstract", "northern lights aurora dark"] },
    { keywords: ["gold", "luxury", "premium", "vip", "prestige", "champion"], searches: ["gold trophy celebration dark", "luxury gold black abstract", "gold confetti celebration night"] },
    { keywords: ["matrix", "hacker", "code", "digital", "terminal", "algorithm"], searches: ["matrix code green digital", "server room data center", "digital technology abstract green"] },
    { keywords: ["sunset", "tropical", "beach", "paradise", "summer", "island"], searches: ["sunset tropical beach paradise", "palm trees sunset ocean", "tropical luxury resort golden hour"] },
    { keywords: ["space", "galaxy", "cosmic", "star", "nebula", "universe"], searches: ["galaxy space nebula dark", "cosmic stars night sky", "space exploration dark dramatic"] },
    { keywords: ["forest", "nature", "jungle", "green", "earth"], searches: ["dark forest mystical green", "nature landscape aerial", "jungle canopy dramatic light"] },
    { keywords: ["crypto", "bitcoin", "blockchain", "web3"], searches: ["cryptocurrency bitcoin technology", "blockchain digital abstract", "crypto trading futuristic"] },
    { keywords: ["gaming", "esport", "arena", "battle", "warrior", "combat"], searches: ["esports gaming arena neon", "competitive gaming dark dramatic", "gaming setup neon lights"] },
  ];

  for (const pattern of themePatterns) {
    if (pattern.keywords.some((kw) => text.includes(kw))) {
      queries.push(...pattern.searches);
    }
  }

  // If no specific theme matched, extract key descriptive words
  if (queries.length === 0) {
    // Extract color + mood words
    const colorMoodWords = text.match(/\b(dark|light|bright|neon|glowing|dramatic|cinematic|luxury|premium|professional|modern|clean|minimal|bold|futuristic|elegant|sleek|vibrant)\b/g);
    if (colorMoodWords && colorMoodWords.length > 0) {
      queries.push(`${colorMoodWords.slice(0, 3).join(" ")} abstract background`);
    }
    // Fallback to generic but relevant queries
    queries.push("trading finance dark professional");
  }

  return queries;
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

IMAGE PLACEMENT RULES (CRITICAL — FOLLOW EXACTLY):
• You MUST use at least 6-8 different images across the page — MORE IS BETTER
• Hero section → "backgroundImage" = pick the most dramatic/cinematic image
• image-text sections → "image" = pick contextually relevant image for EACH section
• banner section → "backgroundImage" = pick a wide, atmospheric image
• CTA section → "backgroundImage" = pick an inspiring/motivational image
• gallery items → "image" = one UNIQUE image per item (use 4-6 items)
• features items → "image" = add an image to at least 2 feature cards
• NEVER reuse the same image URL twice on the same page
• ALWAYS copy the full URL exactly as shown (starting with https://images.pexels.com/)
• DISTRIBUTE images across ALL section types — don't cluster them in one place
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

═══════════════════════════════════════════════════════

CUSTOM CSS — Theme-Level Styling (IMPORTANT)
═══════════════════════════════════════════════════════

You can output a "customCss" field alongside sections. This CSS is injected into a <style> tag
on the page and allows you to create TRULY UNIQUE themed pages with effects that go beyond
what the section system alone supports.

THE USER'S THEME MUST BE REFLECTED IN CUSTOM CSS. If they ask for "radioactive green", every
glow, shadow, and animation must use green. If "fire inferno", use reds and oranges.

Examples of what to include in customCss (COMBINE multiple effects):

1. GLOWING TEXT EFFECTS (match theme color):
   .lp-glow { text-shadow: 0 0 20px rgba(0,255,100,0.5), 0 0 40px rgba(0,255,100,0.3); }

2. PULSING CTA BUTTON:
   @keyframes pulse-glow { 0%,100%{box-shadow:0 0 15px rgba(255,200,0,0.4)} 50%{box-shadow:0 0 35px rgba(255,200,0,0.8)} }
   .lp-pulse { animation: pulse-glow 2s ease-in-out infinite; }

3. GLASSMORPHISM CARDS:
   .lp-glass { background: rgba(255,255,255,0.05); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }

4. ANIMATED GRADIENT BACKGROUND:
   @keyframes gradient-shift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
   .lp-animated-bg { background-size: 200% 200%; animation: gradient-shift 8s ease infinite; }

5. FADE-IN ON SCROLL (simple):
   @keyframes fade-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
   .lp-fade-in { animation: fade-up 0.8s ease-out forwards; }

6. FLOATING PARTICLES (subtle):
   @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-15px)} }
   .lp-float { animation: float 4s ease-in-out infinite; }

7. SCAN-LINE OVERLAY:
   .lp-scanline::after { content:''; position:absolute; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px); pointer-events:none; }

8. SHIMMER / METALLIC TEXT:
   @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
   .lp-shimmer { background:linear-gradient(90deg,#fff,#ffd700,#fff); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:shimmer 3s linear infinite; }

RULES:
- ALL CSS classes MUST be prefixed with "lp-" to avoid conflicts
- Keep it under 40 lines — focused and impactful
- Match the COLOR of the user's theme (green for radioactive, blue for ocean, etc.)
- Combine 3-5 effects for a polished look
- The page already has dark backgrounds — design for dark mode

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
  return `You are a world-class landing page designer and conversion rate optimizer with 15 years of experience at top agencies like Pentagram, IDEO, and Huge. Your specialty is transforming basic templates into stunning, high-converting pages with UNIQUE visual themes.

${DESIGN_SYSTEM}

${SECTION_TYPES_DOC}

${imageCatalogue}

YOUR ENHANCEMENT MISSION:
You will receive an existing landing page template AND the user's specific theme instructions.
Your job is to DRAMATICALLY transform it to match the user's EXACT THEME — not just edit text, but redesign the entire visual experience to match their vision.

ENHANCEMENT STRATEGY:
1. READ the user's instructions carefully — if they say "radioactive green", EVERYTHING must feel radioactive green. If "ocean blue luxury", EVERYTHING must feel like deep ocean luxury.
2. Choose accentColors that MATCH the theme (green/emerald for radioactive, blue/cyan for ocean, rose/orange for fire, violet/pink for synthwave, etc.)
3. Add "style" objects to EVERY section with varied bgGradient that match the theme
4. ADD 2-3 new sections (image-text, banner, gallery) to create a richer page
5. REWRITE ALL COPY to match the TONE and THEME the user describes:
   - If gaming theme: use gaming language, competition metaphors
   - If luxury theme: use exclusive, prestige, VIP language
   - If tech theme: use innovation, cutting-edge, algorithm language
   - Headlines: Power words, emotional triggers, specific numbers. Max 8 words.
6. Use 6-8 DIFFERENT Pexels images — they should ALL be relevant to the theme
7. Use DIFFERENT background gradients per section — but ALL within the theme color family
8. Use DIFFERENT layout variants (features: "alternating", testimonials: "cards")
9. Generate "customCss" with 3-5 CSS effects that match the theme

CRITICAL: Return ONLY a JSON object: { "sections": [...], "customCss": "..." }
The customCss should include theme-appropriate CSS animations, glows, glass effects, etc.
NO markdown. NO explanation. NO commentary. ONLY the JSON object.`;
}

function getGenerateSystemPrompt(imageCatalogue: string): string {
  return `You are a world-class landing page designer, copywriter, and conversion expert with deep expertise in themed, immersive web experiences. You create pages that feel like they belong to billion-dollar brands. Every page has a UNIQUE VISUAL IDENTITY that matches the user's exact theme.

The platform is a TRADING COMPETITION platform where users trade with virtual funds and compete for real cash prizes.

${DESIGN_SYSTEM}

${SECTION_TYPES_DOC}

${imageCatalogue}

YOUR GENERATION MISSION:
Create a COMPLETELY UNIQUE, visually stunning, THEMED landing page. The user will describe a specific theme, mood, or concept. YOU MUST FOLLOW IT EXACTLY.

THEME ADHERENCE (CRITICAL):
- If the user says "radioactive green" → ALL accent colors should be green/emerald, gradients should use green/emerald tones, copy should use radioactive/wasteland metaphors
- If the user says "ocean luxury" → ALL accents blue/cyan, gradients navy/blue, copy uses ocean/depth metaphors
- If the user says "fire inferno" → ALL accents rose/orange, gradients red/orange, copy uses fire/battle metaphors
- The theme must be CONSISTENT throughout — not just the hero, but EVERY section should feel themed
- ALL Pexels images should match the theme — don't use a beach image in a cyberpunk page

MANDATORY REQUIREMENTS:
1. Create 8-10 sections using a MIX of types. Include at least:
   - 1 hero section (with dramatic Pexels background matching theme)
   - 2-3 image-text sections (with real Pexels images, alternating "default" and "reversed" layouts)
   - 1 features section (with "alternating" layout and images on 2+ items)
   - 1 stats section (with specific non-round numbers)
   - 1 banner section (with atmospheric Pexels background)
   - 1 gallery section (with 4-6 unique Pexels images)
   - 1 testimonials section (with "cards" layout)
   - 1 faq section (5-6 items)
   - 1 cta section (with Pexels background)

2. VISUAL THEMING — every section must have a "style" object:
   - Use 2-3 accent colors from the SAME COLOR FAMILY (e.g., emerald + teal + cyan for green themes)
   - Every section needs a bgGradient that uses theme-appropriate colors
   - Use bgImage on hero, banner, CTA, and at least 1 image-text section
   - Vary layouts: features→"alternating", how-it-works→"horizontal", testimonials→"cards"

3. THEMED COPYWRITING:
   - Hero headline: 5-8 words using THEME METAPHORS (not generic "Start Trading")
   - Subheadlines: Expand with SPECIFIC numbers AND theme language
   - CTAs: Theme-appropriate action words + benefit + urgency
   - Badge: Social proof with specific numbers + theme flavor
   - Every headline should use language that fits the theme world

4. AUTHENTIC TESTIMONIALS with theme flavor:
   - Different nationalities, trading styles, experience levels
   - Mention specific pairs (EUR/USD, BTC, Gold), amounts won
   - Use theme-appropriate language in quotes
   - Mix of 4★ and 5★ ratings

5. IMAGE DISTRIBUTION (CRITICAL — at least 8 unique images):
   - Hero: 1 dramatic background
   - Image-text sections: 1 per section (2-3 images)
   - Banner: 1 atmospheric background
   - Gallery: 4-6 unique images (EACH with a different URL)
   - CTA: 1 inspiring background
   - Features: 1-2 on feature items
   - NEVER reuse the same URL

6. CUSTOM CSS (REQUIRED):
   Generate a "customCss" string with 3-5 CSS effects matching the theme:
   - Glowing effects in the theme's primary color
   - A pulsing/animated CTA button
   - Glassmorphism or frosted glass card effects
   - A subtle background animation or text effect
   - All CSS classes must be prefixed with "lp-"

Section order: hero → image-text → features → stats → banner → image-text → how-it-works → testimonials → gallery → faq → cta

CRITICAL: Return ONLY a JSON object: { "sections": [...], "customCss": "..." }
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

    // ── Fetch Pexels images with THEME-AWARE queries ──────────────────
    let pexelsPhotos: PexelsPhoto[] = [];
    if (config.pexelsKey) {
      // Reason: Extract theme keywords from user instructions for highly relevant images
      const themeQueries = extractThemeKeywords(instructions);
      const searchQueries: string[] = [];

      // Priority 1: User-specified image query
      if (imageQuery) {
        searchQueries.push(imageQuery);
      }
      // Priority 2: Theme-extracted queries
      searchQueries.push(...themeQueries);
      // Priority 3: Always include 1-2 generic trading/finance queries as fallback
      searchQueries.push("professional trading desk monitors dark");
      searchQueries.push("financial success celebration dark");

      // Deduplicate queries
      const uniqueQueries = [...new Set(searchQueries)].slice(0, 8);

      pexelsPhotos = await fetchDiversePexelsImages(
        config.pexelsKey,
        uniqueQueries,
        8, // 8 per query × 8 queries = up to 64 images, deduped to ~30-40
      );
      console.log(
        `📸 Fetched ${pexelsPhotos.length} Pexels images from ${uniqueQueries.length} queries: [${uniqueQueries.join(", ")}]`,
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
      temperature: 0.95,
      max_tokens: 16000,
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

    // Normalize response structure and extract customCss
    let rawSections: unknown[];
    let aiCustomCss = "";

    if (Array.isArray(parsed)) {
      rawSections = parsed;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const objMap = new Map(Object.entries(obj));

      // Extract customCss if present
      const cssVal = objMap.get("customCss") || objMap.get("custom_css") || objMap.get("css");
      if (typeof cssVal === "string" && cssVal.trim().length > 0) {
        aiCustomCss = cssVal.trim();
      }

      const wrapperKeys = [
        "sections",
        "data",
        "result",
        "pages",
        "landing_page",
        "content",
      ];
      const arrayKey = wrapperKeys.find((k) => {
        const val = objMap.get(k);
        return Array.isArray(val);
      });
      if (arrayKey) {
        rawSections = objMap.get(arrayKey) as unknown[];
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

    console.log(
      `🎨 Custom CSS: ${aiCustomCss ? `${aiCustomCss.length} chars` : "none"}`,
    );

    return NextResponse.json({
      success: true,
      sections: resultSections,
      customCss: aiCustomCss || "",
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
