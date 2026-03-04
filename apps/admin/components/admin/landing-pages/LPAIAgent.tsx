"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  Wand2,
  ArrowLeft,
  Image as ImageIconLucide,
  Copy,
  Check,
  Lightbulb,
  PenTool,
  Layers,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { LPSection, LPTemplate } from "./lp-types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sections?: LPSection[];
  customCss?: string;
  pexelsImages?: { id: number; url: string; photographer: string; alt: string }[];
  usage?: { model: string; promptTokens: number; completionTokens: number };
  timestamp: number;
}

interface Props {
  /** If provided, AI will enhance this template */
  template?: LPTemplate | null;
  /** If provided, AI will enhance these existing sections */
  existingSections?: LPSection[];
  /** Called when user accepts AI-generated sections + custom CSS */
  onAcceptSections: (sections: LPSection[], customCss?: string) => void;
  onBack: () => void;
}

// ─── Themed Prompt Templates ─────────────────────────────────────────────────
// Each prompt has a short title (shown in sidebar) and the full detailed text (sent to chat)

interface ThemedPrompt {
  emoji: string;
  title: string;
  prompt: string;
  pexelsHint: string; // Auto-set as image search when selected
}

const THEMED_PROMPTS: ThemedPrompt[] = [
  {
    emoji: "☢️",
    title: "Radioactive Wasteland Arena",
    pexelsHint: "neon green cyberpunk dark city",
    prompt: `Create a visually stunning, high-end landing page for a "Fallout Radioactive" themed Forex Trading Competition.

🎨 Theme & Style: Dark, cinematic, post-apocalyptic radioactive theme. Inspired by glowing neon green radiation effects. Black, deep charcoal, toxic green color palette. Premium, high-stakes financial competition vibe. Futuristic + gaming + trading fusion aesthetic.

🏆 Hero Section: Full-width radioactive themed banner. Large bold headline: "ENTER THE €50,000 RADIOACTIVE FOREX ARENA". Subheadline: "Trade. Compete. Dominate the Wasteland." Animated glowing CTA button: "JOIN THE COMPETITION". Use high-quality Pexels background image with dark green overlay.

💰 Prize Pool Section: €50,000 Prize Pool. Breakdown: 🥇 1st – €25,000, 🥈 2nd – €15,000, 🥉 3rd – €10,000. Metallic / glowing card UI.

🎮 Create 3-4 alternating image-text sections: "Radioactive Trading Arena" — High-intensity live competition. "Elite Traders Only" — Compete against top traders worldwide. "Real-Time Leaderboard" — Track profits and rankings live. "High-Risk. High-Reward." — Showcase strategy under pressure. Use at least 6 different Pexels images.

🖼 Gallery Section: Grid layout (3x2) with gaming-themed + trading desk images.

📈 How It Works: Register → Trade → Win Big. Icon-based futuristic card design.

🟢 Final CTA: "Are You Ready to Survive the Forex Fallout?" CTA: "Enter the Arena Now"

Custom CSS: Glowing green text shadows, pulsing CTA button animation, subtle scan-line overlay effect, glassmorphism cards.`,
  },
  {
    emoji: "🌊",
    title: "Ocean Deep Blue Luxury",
    pexelsHint: "ocean deep blue luxury yacht night",
    prompt: `Create a premium, luxurious "Deep Ocean Blue" themed landing page for a high-stakes Forex Trading Championship.

🎨 Theme & Style: Deep ocean blue, midnight navy, and pearl white color palette. Liquid, flowing, aquatic-inspired design. Premium luxury yacht club aesthetic. Calm authority meets financial power. Elegant typography with flowing section transitions.

🏆 Hero Section: Dramatic ocean/night sky background image. Headline: "DIVE INTO €100,000 OF PURE TRADING EXCELLENCE". Subheadline: "Where the deepest strategies surface as champions." Pearl-white CTA: "Claim Your Spot". Badge: "🌊 Limited to 500 Elite Traders".

💎 Prize Section: €100,000 total. 🥇 €50,000 · 🥈 €30,000 · 🥉 €20,000. Cards with subtle blue glassmorphism, underwater depth effect.

🌀 Image-Text Sections (alternating): "Navigate Uncharted Waters" — Deep market analysis tools. "Surface as a Champion" — Rise through the leaderboard. "Dive Deeper Than Ever" — Advanced trading instruments.

🐚 Gallery: 6 images — luxury trading setups, ocean views, yacht lifestyle, night city views.

📊 Stats Section: Impressive numbers with blue accents — "$4.2M+ in prizes awarded", "23,847 Active Traders".

🔵 Final CTA: Deep ocean background, "Ready to Make Waves?" CTA: "Start Trading Now".

Custom CSS: Flowing wave animation at section borders, blue glowing card borders, subtle bubble particle effects, smooth text fade-in animations.`,
  },
  {
    emoji: "🔥",
    title: "Inferno Fire Championship",
    pexelsHint: "fire flames dark red dramatic explosion",
    prompt: `Create an intense, adrenaline-pumping "Inferno" themed landing page for a Forex Trading Championship.

🎨 Theme & Style: Blazing fire reds, deep charcoal, molten orange-gold palette. Aggressive, competitive, high-energy aesthetic. Dark backgrounds with fire/ember accent effects. Inspired by combat sports and elite competition branding.

🏆 Hero Section: Dramatic fire/ember background. Headline: "FORGE YOUR LEGACY IN THE €75,000 INFERNO". Subheadline: "Only the strongest traders survive the flames." Fiery CTA: "IGNITE YOUR TRADING". Badge: "🔥 3,247 Warriors Already Entered".

💰 Prize: €75,000 Pool. 🥇 €35,000 · 🥈 €25,000 · 🥉 €15,000. Cards with ember glow effects.

🎯 Image-Text Sections: "Born in the Fire" — Forged through volatile markets. "Rise from the Ashes" — Turn losses into legendary comebacks. "The Final Blaze" — Championship round. "Warrior's Edge" — Tools that give you the advantage.

🖼 Gallery: 6 dramatic images — flames, trading floors, intense competition moments.

⚡ Features: Lightning-fast execution, real-time fire rankings, transparent scoreboard, 24/7 battle arena.

🔴 Final CTA: "Will You Survive the Inferno?" CTA: "Enter the Flames Now".

Custom CSS: Flickering fire glow on headlines, ember particle animation, pulsing red borders on cards, heat-wave text shimmer effect.`,
  },
  {
    emoji: "💜",
    title: "Cyber Neon Synthwave",
    pexelsHint: "neon purple city night cyberpunk synthwave",
    prompt: `Create a retro-futuristic "Synthwave Neon" themed landing page for a Forex Trading Tournament.

🎨 Theme & Style: Neon purple, hot pink, electric cyan on deep black. 80s retro-futuristic synthwave aesthetic. Grid lines, chrome text, sunset gradients. Inspired by Tron, Blade Runner, and retro gaming. Cyberpunk meets Wall Street energy.

🏆 Hero Section: Neon city skyline background. Headline: "TRADE THE NEON GRID — €60,000 AWAITS". Subheadline: "Retro style. Future profits. Zero limits." Glowing neon CTA: "JACK IN NOW". Badge: "⚡ 8,432 Traders Connected".

💰 Prize Pool: €60,000. 🥇 €30,000 · 🥈 €18,000 · 🥉 €12,000. Chrome-bordered neon cards.

🎮 Image-Text Sections: "The Neon Grid" — Your digital trading battlefield. "Chrome & Code" — AI-powered market analysis. "Synthwave Profits" — Ride the wave to victory. Use at least 6 Pexels images with cyberpunk/neon city themes.

🖼 Gallery: Neon cityscapes, retro gaming setups, holographic dashboards, futuristic trading.

🎵 How It Works: Connect → Trade → Collect. Neon-bordered step cards.

💜 CTA: "Ready to Enter the Grid?" CTA: "Connect Now".

Custom CSS: Neon text glow (purple/pink), CSS grid-line background pattern, chrome text gradient effect, retro scanline overlay, pulsing neon border animations.`,
  },
  {
    emoji: "🏔️",
    title: "Arctic Frost Elite",
    pexelsHint: "arctic ice mountain snow winter landscape",
    prompt: `Create a clean, premium "Arctic Frost" themed landing page for an Elite Forex Trading Competition.

🎨 Theme & Style: Ice white, frosted blue, silver, and deep navy palette. Clean, minimal, and breathtakingly elegant. Frost crystal accents and glass-like transparency. Nordic luxury meets financial precision. Sharp typography, maximum whitespace on dark backgrounds.

🏆 Hero Section: Stunning mountain/arctic landscape background. Headline: "CONQUER THE SUMMIT — €80,000 PRIZE PEAK". Subheadline: "Where disciplined traders reach the top." Crystal-clear CTA: "BEGIN YOUR ASCENT". Badge: "🏔️ Top 1% of Traders Compete Here".

💎 Prize: €80,000 Pool. 🥇 €40,000 · 🥈 €25,000 · 🥉 €15,000. Frosted glass cards.

❄️ Image-Text Sections: "Crystal Clear Analysis" — See the market with perfect clarity. "Ice-Cold Discipline" — Master your emotions. "Peak Performance" — Tools built for champions. Each with stunning arctic/mountain Pexels images.

📊 Stats: "$5.8M paid out", "31,294 traders", "150+ competitions", "99.9% uptime". Ice-blue accent.

🏔️ Gallery: 6 images — mountains, northern lights, ice formations, luxury winter scenes.

🔵 CTA: "Will You Reach the Peak?" CTA: "Start Climbing Now".

Custom CSS: Frosted glass card effect (backdrop-blur), subtle snowfall particle animation, ice-crystal border accents, smooth section fade-in transitions.`,
  },
  {
    emoji: "⚡",
    title: "Electric Gold Championship",
    pexelsHint: "gold luxury trophy celebration confetti dark",
    prompt: `Create a prestigious "Electric Gold" themed landing page for a VIP Forex Trading Championship.

🎨 Theme & Style: Rich gold, electric amber, deep black palette. Luxury meets high-voltage energy. Think Formula 1 podium meets Wall Street prestige. Bold metallic accents with electric spark effects. Premium, exclusive, invitation-only feel.

🏆 Hero Section: Dark luxury background with gold particles. Headline: "THE €150,000 GOLD STANDARD CHAMPIONSHIP". Subheadline: "Where legends are made and fortunes are won." Gold-plated CTA: "CLAIM YOUR THRONE". Badge: "👑 By Invitation Only — 200 Seats".

💰 Prize: €150,000. 🥇 €75,000 · 🥈 €45,000 · 🥉 €30,000. Gold-bordered premium cards.

🎯 Image-Text Sections: "The Gold Standard" — Elite trading meets luxury rewards. "Electric Performance" — Lightning-fast execution when it matters. "Champions Circle" — Join the hall of fame. "The Crown Awaits" — Final round glory.

🖼 Gallery: Gold trophies, luxury watches, champagne celebrations, executive trading rooms.

📈 How It Works: Apply → Qualify → Compete → Win. Gold-accent step cards.

⚡ CTA: "Are You Worthy of the Gold Standard?" CTA: "Apply Now".

Custom CSS: Gold shimmer text animation, electric spark particle effects, metallic gradient borders, luxury card shadow effects, prestige hover animations.`,
  },
  {
    emoji: "🌿",
    title: "Matrix Digital Forest",
    pexelsHint: "matrix code green digital technology server",
    prompt: `Create a hacker-aesthetic "Digital Matrix" themed landing page for a Crypto & Forex Trading Challenge.

🎨 Theme & Style: Matrix green, terminal black, digital code rain aesthetic. Hacker/developer culture meets financial markets. Monospace typography, code-inspired layouts. Green-on-black terminal style with modern polish. Data visualization and algorithm trading vibes.

🏆 Hero Section: Digital code rain background. Headline: "DECODE THE MARKET — €45,000 BOUNTY". Subheadline: "Hack the system. Trade the patterns. Collect the rewards." Terminal-style CTA: "> ENTER_THE_MATRIX". Badge: "🌿 12,847 Nodes Connected".

💰 Prize: €45,000 Bounty. 🥇 €22,000 · 🥈 €14,000 · 🥉 €9,000. Terminal-styled cards.

🔓 Image-Text Sections: "Pattern Recognition" — AI-assisted market decoding. "Zero-Day Advantage" — Be first to spot opportunities. "Root Access" — Full control of your strategy. "The Algorithm" — Let data drive your decisions.

📊 Stats: "892ms avg execution", "47,293 trades/day", "$3.1M in bounties", "99.97% uptime". Green matrix style.

🖼 Gallery: Server rooms, code screens, data centers, holographic displays.

🟢 CTA: "Ready to Jack In?" CTA: "> INITIALIZE".

Custom CSS: Matrix code rain animation (CSS keyframes), monospace terminal font, green text shadow glow, typing cursor animation on headlines, scan-line CRT monitor effect.`,
  },
  {
    emoji: "🌅",
    title: "Sunset Paradise Tournament",
    pexelsHint: "sunset tropical beach paradise palm trees",
    prompt: `Create a warm, aspirational "Sunset Paradise" themed landing page for a Summer Forex Trading Tournament.

🎨 Theme & Style: Warm sunset orange, coral pink, golden amber, and deep purple twilight. Tropical paradise meets financial freedom. Aspirational lifestyle imagery — beaches, sunsets, luxury living. Relaxed yet exciting. "Trade from anywhere" lifestyle brand.

🏆 Hero Section: Stunning sunset beach background. Headline: "TRADE YOUR WAY TO PARADISE — €55,000 SUMMER TOURNAMENT". Subheadline: "Sun, strategy, and serious prizes. Your best summer starts here." Warm CTA: "JOIN THE SUMMER TOURNAMENT". Badge: "🌅 Summer 2026 — Limited Edition Event".

💰 Prize: €55,000. 🥇 €27,000 · 🥈 €17,000 · 🥉 €11,000. Sunset-gradient cards.

🏝️ Image-Text Sections: "Trade From Paradise" — Your office is wherever you are. "Golden Hour Strategy" — Best results come with patience. "Island of Winners" — An exclusive community of top traders. Each with tropical/sunset Pexels images.

📊 Stats: "18,432 summer traders", "$2.8M in seasonal prizes", "45 countries", "4.9★ rating".

🖼 Gallery: Sunset beaches, tropical offices, laptop-by-pool, palm tree silhouettes, luxury resorts, golden hour portraits.

🌅 CTA: "Don't Let This Summer Pass You By" CTA: "Secure Your Spot".

Custom CSS: Warm sunset gradient animation on hero, golden glow on CTA buttons, smooth parallax-like section transitions, gentle wave animation at section borders, warm ambient light pulse effects.`,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function LPAIAgent({
  template,
  existingSections,
  onAcceptSections,
  onBack,
}: Props) {
  const isEnhanceMode = !!(template || existingSections?.length);
  const mode = isEnhanceMode ? "enhance" : "generate";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [imageQuery, setImageQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [acceptedIdx, setAcceptedIdx] = useState<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Initialize with system message
  useEffect(() => {
    const systemMsg: ChatMessage = {
      id: "sys-init",
      role: "system",
      content: isEnhanceMode
        ? `I'm ready to enhance your ${template?.name || "landing page"}. Tell me how you'd like me to improve it — I'll rewrite the copy, add professional images from Pexels, and optimize for conversions.`
        : "I'm ready to create a brand-new landing page from scratch. Describe what you need — the theme, target audience, key features, and style — and I'll generate a professional page with compelling copy and Pexels images.",
      timestamp: Date.now(),
    };
    setMessages([systemMsg]);
  }, [isEnhanceMode, template?.name]);

  // ── Send Message ─────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setAcceptedIdx(null);

    try {
      const sectionsToSend =
        mode === "enhance"
          ? existingSections || template?.sections || []
          : undefined;

      const res = await fetch("/api/landing-pages/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          instructions: text,
          sections: sectionsToSend,
          imageQuery: imageQuery || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ ${data.error || "Something went wrong. Please try again."}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: mode === "enhance"
          ? `✨ I've enhanced your landing page with ${data.sections.length} sections.${data.customCss ? " Custom CSS theme applied." : ""} The copy is now more professional and conversion-optimized.${data.pexelsImages?.length ? ` I found ${data.pexelsImages.length} relevant images from Pexels.` : ""} Review below and click **Use This** to apply.`
          : `🚀 I've created a brand-new landing page with ${data.sections.length} sections.${data.customCss ? " 🎨 Includes custom theme CSS with animations." : ""}${data.pexelsImages?.length ? ` Included ${data.pexelsImages.length} professional images from Pexels.` : ""} Review below and click **Use This** to apply, or give me more instructions to refine it.`,
        sections: data.sections,
        customCss: data.customCss || undefined,
        pexelsImages: data.pexelsImages,
        usage: data.usage,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "⚠️ Network error. Please check your connection and try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, mode, existingSections, template?.sections, imageQuery]);

  // ── Accept Sections ──────────────────────────────────────────────────────
  function handleAccept(sections: LPSection[], customCss: string | undefined, msgIdx: number) {
    setAcceptedIdx(msgIdx);
    onAcceptSections(sections, customCss);
    toast.success("Sections applied! Opening editor...");
  }

  // ── Quick Suggestion ─────────────────────────────────────────────────────
  function applySuggestion(prompt: ThemedPrompt) {
    setInput(prompt.prompt);
    setImageQuery(prompt.pexelsHint);
    setShowImageSearch(true);
    textareaRef.current?.focus();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-xl">
              <Bot className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                AI Page {isEnhanceMode ? "Enhancer" : "Generator"}
                <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs">
                  Beta
                </Badge>
              </h2>
              <p className="text-xs text-gray-500">
                {isEnhanceMode
                  ? `Enhancing: ${template?.name || "Custom Page"}`
                  : "Create a professional page from scratch"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Chat Column */}
        <div className="lg:col-span-3 flex flex-col">
          {/* Messages */}
          <Card className="bg-gray-900 border-gray-800 flex-1 min-h-[400px] max-h-[600px] overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  index={idx}
                  isAccepted={acceptedIdx === idx}
                  onAccept={handleAccept}
                />
              ))}

              {loading && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-violet-500/20 rounded-lg shrink-0">
                    <Bot className="h-4 w-4 text-violet-400" />
                  </div>
                  <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                    <span className="text-sm text-gray-400">
                      {mode === "enhance" ? "Enhancing your page..." : "Generating your page..."}
                    </span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-800 p-4">
              {/* Image search toggle */}
              {showImageSearch && (
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-4 w-4 text-gray-500 shrink-0" />
                  <Input
                    value={imageQuery}
                    onChange={(e) => setImageQuery(e.target.value)}
                    placeholder="Custom image search (e.g., 'forex trading charts')"
                    className="bg-gray-800 border-gray-700 text-sm h-8"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowImageSearch(false);
                      setImageQuery("");
                    }}
                    className="text-xs text-gray-500"
                  >
                    Clear
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={
                      isEnhanceMode
                        ? "Tell me how to improve this page..."
                        : "Describe the landing page you want..."
                    }
                    className="bg-gray-800 border-gray-700 text-sm min-h-[60px] max-h-[120px] resize-none pr-12"
                    rows={2}
                    disabled={loading}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="bg-violet-600 hover:bg-violet-500 text-white h-8"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowImageSearch(!showImageSearch)}
                    className={`h-8 ${showImageSearch ? "text-cyan-400" : "text-gray-500"}`}
                    title="Custom image search"
                  >
                    <ImageIconLucide className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar — Suggestions & Info */}
        <div className="space-y-4">
          {/* Quick Suggestions — Themed Prompts */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="py-3">
              <CardTitle className="text-xs text-gray-400 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                Themed Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0 max-h-[350px] overflow-y-auto">
              {THEMED_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => applySuggestion(p)}
                  className="w-full text-left text-xs hover:text-white bg-gray-800 hover:bg-gray-750 rounded-lg px-3 py-2 transition-colors group"
                >
                  <span className="text-sm mr-1.5">{p.emoji}</span>
                  <span className="text-gray-300 group-hover:text-white font-medium">{p.title}</span>
                  <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">{p.prompt.slice(0, 80)}…</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Mode Info */}
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                {isEnhanceMode ? (
                  <Wand2 className="h-4 w-4 text-amber-400" />
                ) : (
                  <PenTool className="h-4 w-4 text-cyan-400" />
                )}
                <span className="text-sm font-medium text-white">
                  {isEnhanceMode ? "Enhance Mode" : "Generate Mode"}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {isEnhanceMode
                  ? "The AI will improve your existing sections with better copy, images, and structure while preserving the layout."
                  : "The AI will create a complete landing page from scratch based on your description. You can iterate and refine."}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                <Sparkles className="h-3 w-3" />
                Powered by OpenAI + Pexels
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-gray-400 mb-2">💡 Tips</p>
              <ul className="space-y-1.5 text-[11px] text-gray-500">
                <li>• Be specific about your target audience</li>
                <li>• Mention prize amounts and competition details</li>
                <li>• Describe the tone (professional, exciting, luxury)</li>
                <li>• Use the image search for custom stock photos</li>
                <li>• You can iterate — ask for refinements after each generation</li>
                <li>• Press Enter to send, Shift+Enter for new line</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  index,
  isAccepted,
  onAccept,
}: {
  message: ChatMessage;
  index: number;
  isAccepted: boolean;
  onAccept: (sections: LPSection[], customCss: string | undefined, idx: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (message.role === "system") {
    return (
      <div className="flex items-start gap-3">
        <div className="p-2 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-lg shrink-0">
          <Bot className="h-4 w-4 text-violet-400" />
        </div>
        <div className="bg-gray-800/50 rounded-xl px-4 py-3 max-w-[85%]">
          <p className="text-sm text-gray-300">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-violet-600/20 border border-violet-500/20 rounded-xl px-4 py-3 max-w-[85%]">
          <p className="text-sm text-gray-200 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  const hasSections = message.sections && message.sections.length > 0;

  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-violet-500/20 rounded-lg shrink-0">
        <Bot className="h-4 w-4 text-violet-400" />
      </div>
      <div className="flex-1 max-w-[90%] space-y-3">
        <div className="bg-gray-800 rounded-xl px-4 py-3">
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{message.content}</p>

          {/* Usage info */}
          {message.usage && (
            <p className="text-[10px] text-gray-600 mt-2">
              {message.usage.model} · {message.usage.promptTokens + message.usage.completionTokens} tokens
            </p>
          )}
        </div>

        {/* Section Preview */}
        {hasSections && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                    size="sm"
                    onClick={() => onAccept(message.sections!, message.customCss, index)}
                    disabled={isAccepted}
                className={
                  isAccepted
                    ? "bg-emerald-600 text-white cursor-default"
                    : "bg-yellow-500 hover:bg-yellow-400 text-black"
                }
              >
                {isAccepted ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Applied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Use This
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="text-xs"
              >
                <Layers className="h-3.5 w-3.5 mr-1" />
                {expanded ? "Hide" : "Preview"} ({message.sections!.length} sections)
              </Button>
            </div>

            {/* Expandable section preview */}
            {expanded && (
              <Card className="bg-gray-950 border-gray-800">
                <CardContent className="p-3 space-y-2">
                  {message.sections!.map((sec) => (
                    <div
                      key={sec.id}
                      className="bg-gray-900 rounded-lg p-3 border border-gray-800"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px]">
                          {sec.type}
                        </Badge>
                        <span className="text-[10px] text-gray-600">#{sec.order + 1}</span>
                      </div>
                      <SectionContentPreview section={sec} />
                    </div>
                  ))}

                  {/* Pexels images used */}
                  {message.pexelsImages && message.pexelsImages.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] text-gray-500 mb-2 flex items-center gap-1">
                        <ImageIconLucide className="h-3 w-3" />
                        Pexels images included
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {message.pexelsImages.map((img) => (
                          <div key={img.id} className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={img.alt}
                              className="h-16 w-24 object-cover rounded-md border border-gray-800"
                            />
                            <p className="text-[9px] text-gray-600 mt-0.5 truncate w-24">
                              📷 {img.photographer}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Content Preview ─────────────────────────────────────────────────

function SectionContentPreview({ section }: { section: LPSection }) {
  const c = section.content || {};

  switch (section.type) {
    case "hero":
      return (
        <div className="space-y-1">
          {c.badge && (
            <p className="text-[10px] text-yellow-400">{String(c.badge)}</p>
          )}
          <p className="text-sm font-semibold text-white">{String(c.headline || "")}</p>
          <p className="text-xs text-gray-400">{String(c.subheadline || "")}</p>
          {c.ctaText && (
            <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] mt-1">
              {String(c.ctaText)}
            </Badge>
          )}
        </div>
      );

    case "features": {
      const items = (c.items || []) as Array<{ title: string; description: string }>;
      return (
        <div>
          {c.headline && (
            <p className="text-xs font-medium text-white mb-1">{String(c.headline)}</p>
          )}
          <div className="grid grid-cols-2 gap-1">
            {items.slice(0, 4).map((item, i) => (
              <div key={i} className="text-[10px]">
                <span className="text-white font-medium">{item.title}</span>
                <span className="text-gray-500 ml-1">{item.description?.slice(0, 40)}...</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "stats": {
      const items = (c.items || []) as Array<{ value: string; label: string }>;
      return (
        <div className="flex gap-3">
          {items.slice(0, 4).map((item, i) => (
            <div key={i} className="text-center">
              <p className="text-xs font-bold text-yellow-400">{item.value}</p>
              <p className="text-[9px] text-gray-500">{item.label}</p>
            </div>
          ))}
        </div>
      );
    }

    case "testimonials": {
      const items = (c.items || []) as Array<{ name: string; quote: string }>;
      return (
        <div className="space-y-1">
          {items.slice(0, 2).map((item, i) => (
            <p key={i} className="text-[10px] text-gray-400 italic">
              &ldquo;{item.quote?.slice(0, 60)}...&rdquo; — {item.name}
            </p>
          ))}
        </div>
      );
    }

    case "cta":
      return (
        <div>
          <p className="text-xs font-semibold text-white">{String(c.headline || c.title || "")}</p>
          {c.ctaText && (
            <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] mt-1">
              {String(c.ctaText)}
            </Badge>
          )}
        </div>
      );

    default:
      return (
        <p className="text-[10px] text-gray-500">
          {JSON.stringify(c).slice(0, 120)}...
        </p>
      );
  }
}
