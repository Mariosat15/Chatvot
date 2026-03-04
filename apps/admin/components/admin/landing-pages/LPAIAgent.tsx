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
  pexelsImages?: { id: number; url: string; photographer: string; alt: string }[];
  usage?: { model: string; promptTokens: number; completionTokens: number };
  timestamp: number;
}

interface Props {
  /** If provided, AI will enhance this template */
  template?: LPTemplate | null;
  /** If provided, AI will enhance these existing sections */
  existingSections?: LPSection[];
  /** Called when user accepts AI-generated sections */
  onAcceptSections: (sections: LPSection[]) => void;
  onBack: () => void;
}

// ─── Prompt Suggestions ──────────────────────────────────────────────────────

const ENHANCE_SUGGESTIONS = [
  "Make it more professional with compelling copy and urgency",
  "Add more social proof and impressive statistics",
  "Make the hero section more dramatic with a strong headline",
  "Rewrite all testimonials to sound more authentic and specific",
  "Make it focused on forex trading competitions",
  "Optimize all CTA buttons for maximum conversions",
];

const GENERATE_SUGGESTIONS = [
  "Create a sleek, modern landing page for a forex trading competition with €50,000 prize pool",
  "Design a landing page for a crypto trading challenge, dark theme, neon accents",
  "Build a beginner-friendly landing page that explains trading competitions simply",
  "Create an exclusive VIP trading tournament page with luxury feel and gold accents",
  "Design a page for a team-based trading competition with leaderboard focus",
  "Build a seasonal summer trading championship page with tropical energy",
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
          ? `✨ I've enhanced your landing page with ${data.sections.length} sections. The copy is now more professional and conversion-optimized.${data.pexelsImages?.length ? ` I found ${data.pexelsImages.length} relevant images from Pexels.` : ""} Review below and click **Use This** to apply.`
          : `🚀 I've created a brand-new landing page with ${data.sections.length} sections.${data.pexelsImages?.length ? ` Included ${data.pexelsImages.length} professional images from Pexels.` : ""} Review below and click **Use This** to apply, or give me more instructions to refine it.`,
        sections: data.sections,
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
  function handleAccept(sections: LPSection[], msgIdx: number) {
    setAcceptedIdx(msgIdx);
    onAcceptSections(sections);
    toast.success("Sections applied! Opening editor...");
  }

  // ── Quick Suggestion ─────────────────────────────────────────────────────
  function applySuggestion(text: string) {
    setInput(text);
    textareaRef.current?.focus();
  }

  const suggestions = isEnhanceMode ? ENHANCE_SUGGESTIONS : GENERATE_SUGGESTIONS;

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
          {/* Quick Suggestions */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="py-3">
              <CardTitle className="text-xs text-gray-400 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                Quick Prompts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => applySuggestion(s)}
                  className="w-full text-left text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-750 rounded-lg px-3 py-2 transition-colors"
                >
                  {s}
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
  onAccept: (sections: LPSection[], idx: number) => void;
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
                onClick={() => onAccept(message.sections!, index)}
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
