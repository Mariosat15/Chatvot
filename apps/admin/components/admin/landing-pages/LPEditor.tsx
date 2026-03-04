"use client";

import { useState } from "react";
import {
  Save,
  Loader2,
  ArrowLeft,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  GripVertical,
  Type,
  AlignLeft,
  BarChart3,
  Star,
  MessageSquare,
  HelpCircle,
  Code,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { LandingPageData, LPSection } from "./lp-types";

interface Props {
  page: LandingPageData | null;
  templateSections?: LPSection[];
  onBack: () => void;
  onSaved: () => void;
}

const SECTION_TYPES = [
  { type: "hero", label: "Hero", icon: Layers },
  { type: "features", label: "Features", icon: Star },
  { type: "stats", label: "Stats", icon: BarChart3 },
  { type: "how-it-works", label: "How It Works", icon: AlignLeft },
  { type: "testimonials", label: "Testimonials", icon: MessageSquare },
  { type: "cta", label: "Call to Action", icon: Type },
  { type: "faq", label: "FAQ", icon: HelpCircle },
  { type: "custom-html", label: "Custom HTML", icon: Code },
] as const;

export default function LPEditor({ page, templateSections, onBack, onSaved }: Props) {
  const isNew = !page?._id;

  const [name, setName] = useState(page?.name || "");
  const [campaign, setCampaign] = useState(page?.campaign || "");
  const [source, setSource] = useState(page?.source || "");
  const [assignedTo, setAssignedTo] = useState(page?.assignedTo || "");
  const [seoTitle, setSeoTitle] = useState(page?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(page?.seoDescription || "");
  const [isActive, setIsActive] = useState(page?.isActive ?? true);
  const [showRisk, setShowRisk] = useState(page?.showRiskDisclaimer ?? true);
  const [sections, setSections] = useState<LPSection[]>(
    page?.sections || templateSections || [],
  );
  const [saving, setSaving] = useState(false);

  // ── Section management ──────────────────────────────────────────────────
  function addSection(type: string) {
    const newSection: LPSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      order: sections.length,
      enabled: true,
      content: getDefaultContent(type),
    };
    setSections([...sections, newSection]);
  }

  function updateSection(id: string, updates: Partial<LPSection>) {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  function removeSection(id: string) {
    setSections(sections.filter((s) => s.id !== id));
  }

  function moveSection(id: string, direction: "up" | "down") {
    const idx = sections.findIndex((s) => s.id === id);
    if (
      (direction === "up" && idx === 0) ||
      (direction === "down" && idx === sections.length - 1)
    )
      return;
    const newSections = [...sections];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const temp = newSections.at(idx)!;
    newSections.splice(idx, 1, newSections.at(swapIdx)!);
    newSections.splice(swapIdx, 1, temp);
    // Re-order
    setSections(newSections.map((s, i) => ({ ...s, order: i })));
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        campaign,
        source,
        assignedTo,
        seoTitle,
        seoDescription,
        isActive,
        showRiskDisclaimer: showRisk,
        sections,
      };

      let res: Response;
      if (isNew) {
        res = await fetch("/api/landing-pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/landing-pages/${page!._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();

      if (isNew && data.trackingUrl) {
        toast.success(`Landing page created! URL: ${data.trackingUrl}`);
      } else {
        toast.success("Landing page saved");
      }
      onSaved();
    } catch {
      toast.error("Failed to save landing page");
    } finally {
      setSaving(false);
    }
  }

  // Preview URL
  const previewUrl = page?.trackingId
    ? `${window.location.origin.replace("admin.", "")}/lp/${page.trackingId}`
    : null;

  const sorted = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h2 className="text-xl font-bold text-white">
            {isNew ? "Create Landing Page" : `Edit: ${page!.name}`}
          </h2>
        </div>
        <div className="flex gap-2">
          {previewUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(previewUrl, "_blank")}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-400 text-black"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Settings */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-sm text-gray-300">Page Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-gray-400 text-xs">Page Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Landing Page"
              className="bg-gray-800 border-gray-700"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Campaign</Label>
            <Input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="Summer 2026"
              className="bg-gray-800 border-gray-700"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Traffic Source</Label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Google Ads, Facebook..."
              className="bg-gray-800 border-gray-700"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Assigned Partner</Label>
            <Input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Marketing partner name"
              className="bg-gray-800 border-gray-700"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">SEO Title</Label>
            <Input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="Page title for search engines"
              className="bg-gray-800 border-gray-700"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">SEO Description</Label>
            <Input
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="Meta description"
              className="bg-gray-800 border-gray-700"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="text-gray-400 text-xs">Active</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={showRisk} onCheckedChange={setShowRisk} />
            <Label className="text-gray-400 text-xs">Show Risk Disclaimer</Label>
          </div>
          {previewUrl && (
            <div className="col-span-full">
              <Label className="text-gray-400 text-xs">Tracking URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm text-yellow-400 bg-gray-800 px-3 py-1.5 rounded font-mono flex-1 truncate">
                  {previewUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(previewUrl);
                    toast.success("URL copied!");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Section */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-sm text-gray-300">Add Section</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SECTION_TYPES.map(({ type, label, icon: Icon }) => (
              <Button
                key={type}
                variant="outline"
                size="sm"
                onClick={() => addSection(type)}
                className="gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-16 text-center">
              <Layers className="h-12 w-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No sections yet. Add sections above to build your page.</p>
            </CardContent>
          </Card>
        ) : (
          sorted.map((section, idx) => (
            <SectionEditor
              key={section.id}
              section={section}
              index={idx}
              total={sorted.length}
              onUpdate={updateSection}
              onRemove={removeSection}
              onMove={moveSection}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Section Editor ───────────────────────────────────────────────────────────
function SectionEditor({
  section,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  section: LPSection;
  index: number;
  total: number;
  onUpdate: (id: string, updates: Partial<LPSection>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  const content = section.content || {};
  const typeInfo = SECTION_TYPES.find((t) => t.type === section.type);
  const Icon = typeInfo?.icon || Code;

  function updateContent(key: string, value: unknown) {
    onUpdate(section.id, {
      content: { ...content, [key]: value },
    });
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-gray-600" />
            <Icon className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-white capitalize">
              {section.type.replace("-", " ")}
            </span>
            <Badge className="text-[10px] bg-gray-800 text-gray-500">
              #{index + 1}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Switch
              checked={section.enabled !== false}
              onCheckedChange={(v) => onUpdate(section.id, { enabled: v })}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={index === 0}
              onClick={() => onMove(section.id, "up")}
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={index === total - 1}
              onClick={() => onMove(section.id, "down")}
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(section.id)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Render content fields based on section type */}
        {(section.type === "hero" || section.type === "cta") && (
          <>
            <div>
              <Label className="text-gray-400 text-xs">
                {section.type === "hero" ? "Headline" : "Title"}
              </Label>
              <Input
                value={String(content.headline || content.title || "")}
                onChange={(e) =>
                  updateContent(
                    section.type === "hero" ? "headline" : "title",
                    e.target.value,
                  )
                }
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">
                {section.type === "hero" ? "Subheadline" : "Subtitle"}
              </Label>
              <Input
                value={String(content.subheadline || content.subtitle || "")}
                onChange={(e) =>
                  updateContent(
                    section.type === "hero" ? "subheadline" : "subtitle",
                    e.target.value,
                  )
                }
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400 text-xs">CTA Text</Label>
                <Input
                  value={String(content.ctaText || "")}
                  onChange={(e) => updateContent("ctaText", e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">CTA URL</Label>
                <Input
                  value={String(content.ctaUrl || "")}
                  onChange={(e) => updateContent("ctaUrl", e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </div>
            {section.type === "hero" && (
              <div>
                <Label className="text-gray-400 text-xs">Background Image URL</Label>
                <Input
                  value={String(content.backgroundImage || "")}
                  onChange={(e) => updateContent("backgroundImage", e.target.value)}
                  placeholder="https://images.pexels.com/..."
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            )}
          </>
        )}

        {(section.type === "features" ||
          section.type === "stats" ||
          section.type === "testimonials" ||
          section.type === "faq") && (
          <div>
            <Label className="text-gray-400 text-xs">Title</Label>
            <Input
              value={String(content.title || "")}
              onChange={(e) => updateContent("title", e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              Edit items in the JSON below (advanced). Use the template
              defaults as a starting point.
            </p>
            <Textarea
              value={JSON.stringify(
                content.items || content.steps || [],
                null,
                2,
              )}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  const key = section.type === "how-it-works" ? "steps" : "items";
                  updateContent(key, parsed);
                } catch {
                  // Invalid JSON — let user keep typing
                }
              }}
              rows={6}
              className="bg-gray-800 border-gray-700 font-mono text-xs mt-2"
            />
          </div>
        )}

        {section.type === "how-it-works" && (
          <div>
            <Label className="text-gray-400 text-xs">Title</Label>
            <Input
              value={String(content.title || "")}
              onChange={(e) => updateContent("title", e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
            <Label className="text-gray-400 text-xs mt-3">Steps (JSON)</Label>
            <Textarea
              value={JSON.stringify(content.steps || [], null, 2)}
              onChange={(e) => {
                try {
                  updateContent("steps", JSON.parse(e.target.value));
                } catch {
                  // Invalid JSON
                }
              }}
              rows={6}
              className="bg-gray-800 border-gray-700 font-mono text-xs mt-1"
            />
          </div>
        )}

        {section.type === "custom-html" && (
          <div>
            <Label className="text-gray-400 text-xs">HTML Content</Label>
            <Textarea
              value={String(content.html || "")}
              onChange={(e) => updateContent("html", e.target.value)}
              rows={10}
              className="bg-gray-800 border-gray-700 font-mono text-xs"
              placeholder="<div>Your custom HTML...</div>"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Default Content Helpers ─────────────────────────────────────────────────
function getDefaultContent(type: string): Record<string, unknown> {
  switch (type) {
    case "hero":
      return {
        headline: "Start Your Trading Journey",
        subheadline: "Join thousands of traders competing for real prizes",
        ctaText: "Sign Up Free",
        ctaUrl: "/sign-up",
        backgroundImage: "",
      };
    case "features":
      return {
        title: "Why Choose Us",
        items: [
          { id: "f1", title: "Real-Time Trading", description: "Trade with live market data", icon: "TrendingUp" },
          { id: "f2", title: "Competitions", description: "Compete against other traders", icon: "Trophy" },
          { id: "f3", title: "Secure Platform", description: "Enterprise-grade security", icon: "Shield" },
        ],
      };
    case "stats":
      return {
        title: "Platform Stats",
        items: [
          { id: "s1", value: "10K+", label: "Active Traders" },
          { id: "s2", value: "€1M+", label: "Prize Pool" },
          { id: "s3", value: "50+", label: "Markets" },
          { id: "s4", value: "24/7", label: "Support" },
        ],
      };
    case "how-it-works":
      return {
        title: "How It Works",
        steps: [
          { id: "hw1", title: "Sign Up", description: "Create your free account in seconds" },
          { id: "hw2", title: "Join a Competition", description: "Choose from active competitions" },
          { id: "hw3", title: "Trade & Win", description: "Trade with virtual funds and win real prizes" },
        ],
      };
    case "testimonials":
      return {
        title: "What Traders Say",
        items: [
          { id: "t1", name: "Alex T.", quote: "Best trading platform I've used!", rating: 5, role: "Day Trader" },
        ],
      };
    case "cta":
      return {
        title: "Ready to Start Trading?",
        subtitle: "Join our community and compete for prizes",
        ctaText: "Get Started Now",
        ctaUrl: "/sign-up",
      };
    case "faq":
      return {
        title: "Frequently Asked Questions",
        items: [
          { id: "faq1", question: "Is it free to join?", answer: "Yes, you can create an account for free." },
        ],
      };
    case "custom-html":
      return { html: "<div class='text-center py-8'><p>Custom content here</p></div>" };
    default:
      return {};
  }
}
