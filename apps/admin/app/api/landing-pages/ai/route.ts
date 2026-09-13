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

// ─── User-Uploaded Image Catalogue ───────────────────────────────────────────
// Reason: When users upload their own images, we build a catalogue in the same
// format the AI expects, so it can place them across sections just like Pexels images.

function buildUserImageCatalogue(imageUrls: string[]): string {
  if (imageUrls.length === 0) return "\n(No images available — skip backgroundImage fields.)\n";

  const lines = imageUrls.map(
    (url, i) =>
      `  [IMG${i + 1}] ${url} — "User-uploaded image ${i + 1}" (custom)`,
  );

  return `
═══════════════════════════════════════════════════════
USER-UPLOADED IMAGE CATALOGUE — Use ONLY these URLs
═══════════════════════════════════════════════════════
The user has uploaded their own images. You MUST use ONLY these images and
MUST NOT use any other image URLs. Distribute them across sections:

${lines.join("\n")}

IMAGE PLACEMENT RULES (CRITICAL — FOLLOW EXACTLY):
• You MUST use ALL of the user's uploaded images across the page
• Hero section → "backgroundImage" = pick the most dramatic/impactful image
• image-text sections → "image" = distribute remaining images across these sections
• banner section → "backgroundImage" = pick a wide/atmospheric image if available
• CTA section → "backgroundImage" = reuse the most inspiring image
• gallery items → "image" = one image per gallery item (reuse if needed for 6 items)
• features items → "image" = add an image to 1-2 feature cards if images remain
• Copy the EXACT URL paths as shown above (they start with /api/assets/images/)
• If you have fewer images than sections that need them, you may reuse images
  but PRIORITIZE hero and image-text sections
═══════════════════════════════════════════════════════`;
}

// ─── Platform Knowledge (Actual ChartVolt Benefits) ─────────────────────────
// Reason: Without this, the AI makes up generic trading content instead of using
// real platform features and benefits from the ChartVolt documentation.

const PLATFORM_KNOWLEDGE = `
═══════════════════════════════════════════════════════
PLATFORM KNOWLEDGE — ChartVolt Trading Competition Platform
═══════════════════════════════════════════════════════
This is a REAL trading competition platform. ALWAYS use these ACTUAL features and benefits
in landing page copy instead of making up generic content.

WHAT CHARTVOLT IS:
- A gamified trading competition platform where users trade with VIRTUAL credits but can win REAL cash prizes
- White-label solution — fully customizable branding
- Users deposit real money (EUR) to buy credits, enter competitions, trade with virtual capital, and win real prizes

CORE FEATURES (use these in Features/How-It-Works sections):
1. TRADING COMPETITIONS — Multi-user tournaments with configurable prize pools
   • Multiple ranking methods: P&L, ROI, Sharpe Ratio, Win Rate, Total Capital
   • Automatic prize distribution to winners
   • Real-time leaderboards with tie-breaking logic
   • Minimum participant requirements with auto-refund

2. 1v1 CHALLENGES — Head-to-head trading battles
   • Challenge any online trader directly
   • Winner takes all (minus platform fee)
   • Real-time presence detection
   • VS screen with fighter-style presentation

3. 100+ TRADING PAIRS — Forex, Crypto, Stocks, Commodities, Indices
   • Sub-50ms real-time price updates from institutional feeds
   • Professional-grade TradingView charting with 50+ indicators
   • Margin trading with configurable leverage

4. CREDIT WALLET SYSTEM — Virtual currency economy
   • Deposit real money → receive credits
   • Multiple payment methods (Stripe, Nuvei)
   • Secure withdrawals with KYC verification

5. GAMIFICATION — Badges, XP, Levels
   • Earn badges for achievements (Common, Rare, Epic, Legendary)
   • Level progression from Novice to Trading God (10 levels)
   • Social features and achievements

6. ENTERPRISE SECURITY — Fraud detection, device fingerprinting, audit logs
   • Multi-account detection, VPN/proxy detection
   • Comprehensive KYC integration (Veriff)

COPY GUIDELINES — When writing about platform benefits:
- Use SPECIFIC numbers: "100+ trading pairs", "sub-50ms execution", "$2.47M+ in prizes awarded"
- Mention REAL features: "TradingView-powered charts", "real-time leaderboards", "1v1 challenges"
- Reference ACTUAL flow: "Deposit → Enter → Trade → Win → Withdraw"
- NEVER make up features the platform doesn't have
- ALWAYS tie theme language to real platform value (e.g., "Navigate the Radioactive Markets" → real-time forex trading)
═══════════════════════════════════════════════════════`;

// ─── Game Icons Catalogue ────────────────────────────────────────────────────
// Reason: The platform has hundreds of game-themed PNG icons in /game-icons/.
// The AI should use these for feature items, stats, how-it-works steps, etc.
// The LP renderer will display them as <img> elements when the path starts with "/game-icons/"

const GAME_ICONS_CATALOGUE = `
═══════════════════════════════════════════════════════
GAME ICONS — Themed PNG Icons Available at /game-icons/
═══════════════════════════════════════════════════════

The platform has hundreds of high-quality themed PNG icons. Use these in the "icon" field
of features, stats, and how-it-works items. When the icon value starts with "/game-icons/",
the renderer displays it as an image instead of a Lucide SVG.

HOW TO USE: Set the "icon" field to the FULL PATH, e.g.: "icon": "/game-icons/skull.png"

CATEGORIES AND RECOMMENDED ICONS BY THEME:

🏆 Trophies & Rankings (for prize sections, leaderboards):
  /game-icons/1. TROPHY.png, /game-icons/2. STAR TROPHY.png, /game-icons/16. GAME TROPHY.png
  /game-icons/3. GOLD MEDAL.png, /game-icons/16. Crown.png, /game-icons/11. CHAMPION AWARD.png
  /game-icons/20. VICTORY AWARD.png, /game-icons/trophy 1 .png, /game-icons/trophy 2 .png

💰 Currency & Treasure (for credit/prize pool sections):
  /game-icons/coin.png, /game-icons/3. Coin.png, /game-icons/gems.png
  /game-icons/treasure.png, /game-icons/chest 1.png, /game-icons/chest 2.png
  /game-icons/5. money.png, /game-icons/money deposite.png, /game-icons/pouch 1.png

⚔️ Weapons (for competitive/battle themes):
  /game-icons/sword.png, /game-icons/9. Sword.png, /game-icons/10. Axe.png
  /game-icons/Bomb.png, /game-icons/Cannon.png, /game-icons/Bow 3D.png
  /game-icons/hammer 1.png, /game-icons/skull.png

🛡️ Defense & Equipment (for security/protection features):
  /game-icons/shield 1.png, /game-icons/shield 2.png, /game-icons/Magic Shiled 3D.png
  /game-icons/helmet 1.png, /game-icons/armor 1.png, /game-icons/15. Key.png

🧪 Potions & Spells (for power-up/advantage themes):
  /game-icons/fire spell.png, /game-icons/lightning speel.png, /game-icons/energi potion.png
  /game-icons/healt potion.png, /game-icons/ice speel.png, /game-icons/rage potion.png
  /game-icons/poison speel.png, /game-icons/blu fire speel.png

📊 Finance & Trading (for platform features):
  /game-icons/1. invest portfolio.png, /game-icons/2. trade.png, /game-icons/3. profit.png
  /game-icons/profit.png, /game-icons/incrase provit.png, /game-icons/stock down.png
  /game-icons/portofolio.png, /game-icons/gold invest.png, /game-icons/dolar plant.png
  /game-icons/Equity.png, /game-icons/fluctuation.png, /game-icons/financial calculation.png

⚠️ Risk & Status (for risk/warning sections):
  /game-icons/1. Risk Warning.png, /game-icons/target.png, /game-icons/timer.png
  /game-icons/warning 1.png, /game-icons/skull.png

🎮 Gaming Hardware (for competitive gaming themes):
  /game-icons/hedset.png, /game-icons/joystick 1.png, /game-icons/keyboard.png, /game-icons/WASD.png

🌲 Characters & Creatures (for RPG/adventure themes):
  /game-icons/7. Rookie.png, /game-icons/8. Lord.png, /game-icons/11. Archer.png, /game-icons/6. War.png

🏴‍☠️ Pirate Theme (for ocean/adventure themes):
  /game-icons/Pirate Ship.png, /game-icons/Anchor.png, /game-icons/Pirate Flag.png
  /game-icons/Pirate Hat.png, /game-icons/Compass.png, /game-icons/Pirate Coins.png

⭐ Stars & Rewards:
  /game-icons/star 1.png, /game-icons/star 2.png, /game-icons/star 3.png
  /game-icons/reward 1.png, /game-icons/reward 2.png, /game-icons/reward 3.png

🔥 Cyber & Tech (for futuristic/cyber themes):
  /game-icons/cyber 1.png through /game-icons/cyber 10.png
  /game-icons/technology 1.png through /game-icons/technology 10.png

ICON SELECTION STRATEGY:
- For RADIOACTIVE/WASTELAND themes: skull, bomb, fire spell, poison potion, warning icons
- For OCEAN/LUXURY themes: anchor, pirate ship, compass, treasure, gems
- For FIRE/INFERNO themes: fire spell, rage potion, bomb, sword, axe
- For CYBER/NEON themes: cyber icons, technology icons, joystick, WASD, headset
- For ARCTIC/FROST themes: ice spell, shield, helmet, key
- For GOLD/VIP themes: crown, trophy, gold medal, gems, treasure, champion award
- For NATURE/FOREST themes: health potion, green spell, bow
- ALWAYS use at least 4-6 different game icons across the page
- Mix game icons with Lucide icons for variety (e.g., game icon on features, Lucide on how-it-works)
═══════════════════════════════════════════════════════`;

// ─── Hero Theme Reference (Inspiration from Hero Page Themes) ────────────────
// Reason: The hero page has complete themed designs. The AI should use these as
// reference for color palettes, effects, and visual identity when users request themed pages.

const THEME_REFERENCE = `
═══════════════════════════════════════════════════════
THEME REFERENCE — Existing Hero Page Themes (Use as Inspiration)
═══════════════════════════════════════════════════════

These are COMPLETE visual themes from the hero page. When a user requests a specific theme,
use these as color/style reference to create a MATCHING experience.

─── FALLOUT / RADIOACTIVE THEME ───
Colors: primary #c8b400 (mustard gold), accent #ff6b00 (orange), background #0a0a05 (near black)
Card background: rgba(42, 42, 26, 0.8), border: #4a4a2a, glow: rgba(200, 180, 0, 0.5)
Text: #e8e8c8 (warm white), muted: #a8a888
Fonts: "Special Elite" cursive for headings, "Roboto Condensed" for body, "VT323" monospace for accent
Effects: dot particles in #c8b400, subtle glow, solid card style
Gradients: from-[#0a0a05] via-[#1a1a0a] to-[#2a2a1a]
Text gradient: from-[#c8b400] to-[#ff6b00]
CTA: bg-[#c8b400] text-black, hover bg-[#a89600], secondary: border-[#ff6b00] text-[#ff6b00]
Icons: ☢️ battle, 🏆 trophy, 💀 CTA icon, 🛡️ users, 💊 currency, ⚡ power
USE: accentColor "green" or "yellow", bgGradient with deep blacks/olives/dark-greens (e.g. from-gray-950 via-green-950 to-gray-950), game icons: skull, bomb, fire spell, poison potion

─── GAMING NEON THEME ───
Colors: primary #a855f7 (purple), accent #ec4899 (pink), background #0a0a1a
Card: rgba(168, 85, 247, 0.1), border: #2d1b69, glow: rgba(168, 85, 247, 0.5)
Effects: sparkle particles, intense glow, neon card style
Gradients: from-[#0a0a1a] via-[#1a0a2e] to-[#0a0a1a]
USE: accentColor "violet" or "pink", neon-style gradients

─── OCEAN LUXURY THEME ───
Colors: primary #0ea5e9 (sky blue), accent #06b6d4 (cyan), background #0a1628
Effects: bubble particles, glass card style, medium glow
USE: accentColor "cyan" or "blue", deep navy gradients

─── INFERNO THEME ───
Colors: primary #ef4444 (red), accent #f97316 (orange), background #0a0505
Effects: sparkle particles in red, intense glow, gradient cards
USE: accentColor "rose" or "orange", dark red gradients

─── ARCTIC THEME ───
Colors: primary #38bdf8 (light blue), accent #e2e8f0 (silver), background #0a1520
Effects: snow particles, glass card style, subtle glow
USE: accentColor "cyan" or "blue", icy blue-white gradients

RULE: When the user specifies a theme, MATCH the color palette and effects from the reference above.
Don't just use the theme NAME — use the actual COLORS and STYLES.
═══════════════════════════════════════════════════════`;

// ─── Design System Documentation ────────────────────────────────────────────

const DESIGN_SYSTEM = `
═══════════════════════════════════════════════════════
DESIGN SYSTEM — Per-Section Visual Theming
═══════════════════════════════════════════════════════

Every section's "content" object can include a "style" sub-object that controls its visual appearance.
By using DIFFERENT style values across sections, you create a visually diverse, professional page.

"style" object properties:
{
  "accentColor": "blue" | "emerald" | "rose" | "violet" | "cyan" | "orange" | "teal" | "pink" | "indigo" | "yellow" | "green",
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

HOW THESE CSS CLASSES ARE APPLIED BY THE RENDERER (automatically):
- .lp-glow → Applied to ALL h1, h2, h3 headlines (hero headline + every section title)
- .lp-pulse, .lp-btn → Applied to primary CTA buttons (hero + CTA section)
- .lp-glass, .lp-card → Applied to feature cards, stat cards, how-it-works step cards
- .lp-float, .lp-icon → Applied to stat icons and step icons
- #lp-page → Wraps the entire landing page; use for global rules like #lp-page { ... }

RULES:
- ALL CSS classes MUST be prefixed with "lp-" to avoid conflicts
- Keep it under 40 lines — focused and impactful
- Match the COLOR of the user's theme (green for radioactive, blue for ocean, etc.)
- Combine 3-5 effects for a polished look
- The page already has dark backgrounds — design for dark mode
- ALWAYS generate .lp-glow and .lp-pulse at minimum — they make the biggest visual impact
- For radioactive themes: use green rgba(0,255,50,...) or rgba(57,255,20,...) for ALL glow effects
- For ocean themes: use blue/cyan rgba(14,165,233,...) or rgba(6,182,212,...)
- For inferno themes: use red/orange rgba(239,68,68,...) or rgba(249,115,22,...)

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
Icons — TWO types supported:
  A) Lucide names: Zap, Shield, Trophy, BarChart3, TrendingUp, Users, Globe, Rocket, Star, Heart, Target, Award, Clock, DollarSign, Lock, Sparkles, Crown, Flame, Gift, Medal, Brain, Lightbulb, Gauge, Gem, Eye
  B) Game icon PATHS (preferred for themed pages): "/game-icons/skull.png", "/game-icons/1. TROPHY.png", etc.
  → See GAME ICONS CATALOGUE above for the full list of available paths.
  → Game icons render as themed PNG images and look much more immersive than SVG icons.

───────────────────────────────────────────────────────
3. type "stats" → Impressive numbers grid
───────────────────────────────────────────────────────
content: {
  "style": { "accentColor": "violet", "bgGradient": "from-slate-950 via-violet-950 to-indigo-950" },
  "title": "Section headline",
  "subtitle": "Optional subtitle",
  "items": [
    { "value": "$2.47M+", "label": "Total Prizes Awarded", "icon": "/game-icons/5. money.png" }
  ]
}
Use 3-4 stats with SPECIFIC non-round numbers for credibility.
"icon" supports both Lucide names AND game icon paths (see GAME ICONS CATALOGUE).

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
"icon" supports both Lucide names AND game icon paths (e.g., "/game-icons/15. Key.png").
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

${PLATFORM_KNOWLEDGE}

${GAME_ICONS_CATALOGUE}

${THEME_REFERENCE}

${DESIGN_SYSTEM}

${SECTION_TYPES_DOC}

${imageCatalogue}

YOUR ENHANCEMENT MISSION:
You will receive an existing landing page template AND the user's specific theme instructions.
Your job is to DRAMATICALLY transform it to match the user's EXACT THEME — not just edit text, but redesign the entire visual experience to match their vision.

ENHANCEMENT STRATEGY:
1. READ the user's instructions carefully — if they say "radioactive green", EVERYTHING must feel radioactive green. If "ocean blue luxury", EVERYTHING must feel like deep ocean luxury.
2. Choose accentColors that MATCH the theme — CHECK THE THEME REFERENCE section for exact color palettes
3. Add "style" objects to EVERY section with varied bgGradient that match the theme
4. ADD 2-3 new sections (image-text, banner, gallery) to create a richer page
5. REWRITE ALL COPY using ACTUAL PLATFORM FEATURES from the PLATFORM KNOWLEDGE section:
   - Features/Benefits must describe REAL ChartVolt features (competitions, 1v1 challenges, 100+ pairs, real-time leaderboards)
   - Wrap real features in THEME LANGUAGE (e.g., "Navigate Toxic Markets" → but the underlying benefit is real-time forex trading)
   - Use SPECIFIC numbers from platform knowledge ($2.47M+ prizes, 100+ trading pairs, sub-50ms execution)
   - NEVER make up features the platform doesn't have
6. Use 6-8 DIFFERENT Pexels images — they should ALL be relevant to the theme
7. Use DIFFERENT background gradients per section — but ALL within the theme color family
8. Use DIFFERENT layout variants (features: "alternating", testimonials: "cards")
9. Generate "customCss" with 5-8 CSS effects that match the theme (glows, animations, particles)
10. Use GAME ICONS from /game-icons/ for features and stats items — pick icons that match the theme
11. Mix game icon paths and Lucide icon names for variety

CRITICAL: Return ONLY a JSON object: { "sections": [...], "customCss": "..." }
The customCss should include theme-appropriate CSS animations, glows, glass effects, etc.
NO markdown. NO explanation. NO commentary. ONLY the JSON object.`;
}

function getGenerateSystemPrompt(imageCatalogue: string): string {
  return `You are a world-class landing page designer, copywriter, and conversion expert with deep expertise in themed, immersive web experiences. You create pages that feel like they belong to billion-dollar brands. Every page has a UNIQUE VISUAL IDENTITY that matches the user's exact theme.

${PLATFORM_KNOWLEDGE}

${GAME_ICONS_CATALOGUE}

${THEME_REFERENCE}

${DESIGN_SYSTEM}

${SECTION_TYPES_DOC}

${imageCatalogue}

YOUR GENERATION MISSION:
Create a COMPLETELY UNIQUE, visually stunning, THEMED landing page. The user will describe a specific theme, mood, or concept. YOU MUST FOLLOW IT EXACTLY.

THEME ADHERENCE (CRITICAL):
- CHECK THE THEME REFERENCE section above for exact color palettes and visual styles
- If the user says "radioactive" or "fallout" → Use the FALLOUT THEME colors (toxic green #39ff14, neon green, dark charcoal/olive backgrounds), accentColor "green"/"yellow", bgGradients like "from-gray-950 via-green-950 to-gray-950", game icons like skull, bomb, poison potion, fire spell
- If the user says "ocean luxury" → Use OCEAN THEME colors (sky blue, cyan, navy), accentColor "cyan"/"blue", game icons like anchor, pirate ship, compass, treasure
- If the user says "fire inferno" → Use INFERNO THEME colors (red, orange, dark red), accentColor "rose"/"orange", game icons like fire spell, rage potion, sword
- If "cyberpunk/neon" → GAMING NEON colors (purple, pink, dark navy), accentColor "violet"/"pink", cyber/tech icons
- The theme must be CONSISTENT throughout — not just the hero, but EVERY section should feel themed
- ALL Pexels images should match the theme — don't use a beach image in a cyberpunk page

MANDATORY REQUIREMENTS:
1. Create 10-12 sections using a MIX of types. Include at least:
   - 1 hero section (with dramatic Pexels background matching theme)
   - 2-3 image-text sections (with real Pexels images, alternating "default" and "reversed" layouts)
   - 1 features section (with "alternating" layout and images on 2+ items, use GAME ICONS)
   - 1 stats section (with specific non-round numbers from PLATFORM KNOWLEDGE, use GAME ICONS)
   - 1 banner section (with atmospheric Pexels background)
   - 1 gallery section (with 4-6 unique Pexels images)
   - 1 testimonials section (with "cards" layout)
   - 1 how-it-works section (3-4 steps with "horizontal" layout)
   - 1 faq section (5-6 items about REAL platform features)
   - 1 cta section (with Pexels background)

2. VISUAL THEMING — every section must have a "style" object:
   - Use 2-3 accent colors from the SAME COLOR FAMILY (e.g., emerald + teal + cyan for green themes)
   - Every section needs a bgGradient that uses theme-appropriate colors
   - Use bgImage on hero, banner, CTA, and at least 1 image-text section
   - Vary layouts: features→"alternating", how-it-works→"horizontal", testimonials→"cards"

3. THEMED COPYWRITING with REAL PLATFORM FEATURES:
   - Hero headline: 5-8 words using THEME METAPHORS (not generic "Start Trading")
   - Subheadlines: REAL platform benefits wrapped in theme language
   - Features: REAL ChartVolt features (competitions, 1v1 challenges, 100+ pairs, leaderboards, badges, credit wallet)
   - Stats: REAL numbers (100+ Trading Pairs, Sub-50ms Execution, $2.47M+ Prizes Awarded, 10,000+ Traders)
   - FAQs: Answer REAL questions about how competitions work, prizes, deposits, trading
   - CTAs: Theme-appropriate action words + benefit + urgency
   - Badge: Social proof with specific numbers + theme flavor
   - EVERY headline uses theme language but describes REAL features

4. GAME ICONS (CRITICAL — use at least 4-6 across the page):
   - Features items → use game icon paths as "icon" value (e.g., "/game-icons/1. TROPHY.png")
   - Stats items → use game icon paths for visual impact
   - How-it-works steps → mix Lucide names AND game icon paths
   - Pick icons that MATCH THE THEME (see GAME ICONS CATALOGUE above)

5. AUTHENTIC TESTIMONIALS with theme flavor AND real trading context:
   - Mention SPECIFIC features: "The real-time leaderboard kept me on edge"
   - Reference trading pairs: EUR/USD, BTC/USD, Gold
   - Mention competition prizes: "Won €15,000 in the Championship"
   - Different nationalities, trading styles, experience levels
   - Mix of 4★ and 5★ ratings

6. IMAGE DISTRIBUTION (CRITICAL — at least 8 unique Pexels images):
   - Hero: 1 dramatic background
   - Image-text sections: 1 per section (2-3 images)
   - Banner: 1 atmospheric background
   - Gallery: 4-6 unique images (EACH with a different URL)
   - CTA: 1 inspiring background
   - Features: 1-2 on feature items
   - NEVER reuse the same URL

7. CUSTOM CSS (REQUIRED — make it DRAMATIC):
   Generate a "customCss" string with 5-8 CSS effects matching the theme:
   - Glowing text effects in the theme's primary color (text-shadow)
   - A pulsing/animated CTA button with theme-colored glow
   - Glassmorphism or frosted glass card effects
   - Animated gradient backgrounds or shimmer effects
   - Floating/particle-like animations
   - Scan-line or overlay effects for appropriate themes
   - All CSS classes must be prefixed with "lp-"
   - CSS MUST use theme-appropriate colors (green for radioactive, blue for ocean, etc.)

Section order: hero → image-text → features → stats → banner → image-text → how-it-works → testimonials → gallery → faq → cta

CRITICAL: Return ONLY a JSON object: { "sections": [...], "customCss": "..." }
NO markdown. NO explanation. NO commentary. ONLY the JSON.`;
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, instructions, sections, imageQuery, userImages } = body as {
      mode: "enhance" | "generate";
      instructions: string;
      sections?: LPSection[];
      imageQuery?: string;
      userImages?: string[]; // User-uploaded image URLs — when provided, skip Pexels
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

    // ── Determine image source: user uploads OR Pexels ─────────────────
    // Reason: When user uploads their own images, use ONLY those.
    // This gives users full control over the visual identity of the page.
    const hasUserImages = Array.isArray(userImages) && userImages.length > 0;
    let pexelsPhotos: PexelsPhoto[] = [];
    let imageCatalogue: string;

    if (hasUserImages) {
      // ── User-provided images — skip Pexels entirely ───────────────
      console.log(`📎 User provided ${userImages.length} images — skipping Pexels`);
      imageCatalogue = buildUserImageCatalogue(userImages);
    } else if (config.pexelsKey) {
      // ── Fetch Pexels images with THEME-AWARE queries ──────────────
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
      imageCatalogue = buildImageCatalogue(pexelsPhotos);
    } else {
      console.warn("⚠️ No Pexels API key and no user images — AI will generate without images");
      imageCatalogue = buildImageCatalogue([]);
    }

    // ── Build prompt ──────────────────────────────────────────────────
    const systemPrompt =
      mode === "enhance"
        ? getEnhanceSystemPrompt(imageCatalogue)
        : getGenerateSystemPrompt(imageCatalogue);

    const imageInstruction = hasUserImages
      ? `\n\nIMPORTANT: The user uploaded ${userImages.length} custom image${userImages.length > 1 ? "s" : ""}. You MUST use ONLY the user's uploaded images (see the IMAGE CATALOGUE). Do NOT use any other image URLs. Distribute them across hero, image-text, banner, CTA, and gallery sections.`
      : `\n\nUse 4-6 different Pexels images from the catalogue across sections.`;

    let userPrompt: string;
    if (mode === "enhance") {
      userPrompt = `EXISTING LANDING PAGE SECTIONS TO ENHANCE:\n\n${JSON.stringify(sections, null, 2)}\n\nMY INSTRUCTIONS:\n${instructions}${imageInstruction}\n\nRemember: Transform the VISUAL DESIGN, not just text. Add "style" objects with different accentColors, bgGradients, layouts. Make it look like a $50,000 custom-designed page.`;
    } else {
      userPrompt = `CREATE A UNIQUE LANDING PAGE WITH THESE REQUIREMENTS:\n\n${instructions}${imageInstruction}\n\nRemember:\n- Use 8-10 sections with varied types (hero, image-text, features, stats, banner, testimonials, faq, cta)\n- Every section needs a "style" object with DIFFERENT accentColors and bgGradients\n- Write world-class copy with specific numbers and social proof\n- Make it visually stunning — this should look like it was designed by a top agency`;
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
      pexelsImages: hasUserImages
        ? [] // No Pexels images when user uploaded their own
        : pexelsPhotos.map((p) => ({
            id: p.id,
            url: p.src.large,
            photographer: p.photographer,
            alt: p.alt,
          })),
      userImagesUsed: hasUserImages ? userImages.length : 0,
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
