"use client";

import { useState, useRef } from "react";
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
  Camera,
  X,
  Image as ImageIcon,
  Columns,
  GalleryHorizontal,
  Plus,
  Upload,
  ChevronDown,
  ChevronUp,
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
import PexelsImageBrowser from "./PexelsImageBrowser";

// ─── Constants ──────────────────────────────────────────────────────────────

interface Props {
  page: LandingPageData | null;
  templateSections?: LPSection[];
  templateCustomCss?: string;
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
  { type: "image-text", label: "Image + Text", icon: Columns },
  { type: "banner", label: "Banner", icon: ImageIcon },
  { type: "gallery", label: "Gallery", icon: GalleryHorizontal },
  { type: "custom-html", label: "Custom HTML", icon: Code },
] as const;

const ACCENT_COLORS = [
  { value: "yellow", label: "Yellow", tw: "bg-yellow-500" },
  { value: "blue", label: "Blue", tw: "bg-blue-500" },
  { value: "emerald", label: "Emerald", tw: "bg-emerald-500" },
  { value: "rose", label: "Rose", tw: "bg-rose-500" },
  { value: "violet", label: "Violet", tw: "bg-violet-500" },
  { value: "cyan", label: "Cyan", tw: "bg-cyan-500" },
  { value: "orange", label: "Orange", tw: "bg-orange-500" },
  { value: "teal", label: "Teal", tw: "bg-teal-500" },
  { value: "pink", label: "Pink", tw: "bg-pink-500" },
  { value: "indigo", label: "Indigo", tw: "bg-indigo-500" },
];

// ─── Main Editor ────────────────────────────────────────────────────────────

export default function LPEditor({ page, templateSections, templateCustomCss, onBack, onSaved }: Props) {
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
  const [customCss, setCustomCss] = useState(page?.customCss || templateCustomCss || "");
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
        customCss: customCss || undefined,
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
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Landing Page" className="bg-gray-800 border-gray-700" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Campaign</Label>
            <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Summer 2026" className="bg-gray-800 border-gray-700" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Traffic Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Google Ads, Facebook..." className="bg-gray-800 border-gray-700" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Assigned Partner</Label>
            <Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Marketing partner name" className="bg-gray-800 border-gray-700" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">SEO Title</Label>
            <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Page title for search engines" className="bg-gray-800 border-gray-700" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">SEO Description</Label>
            <Input value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Meta description" className="bg-gray-800 border-gray-700" />
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
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(previewUrl); toast.success("URL copied!"); }}>
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
              <Button key={type} variant="outline" size="sm" onClick={() => addSection(type)} className="gap-1.5">
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

      {/* Custom CSS */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
            <Code className="h-4 w-4" />
            Custom CSS (Advanced)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-xs mb-2">
            Add custom CSS to override default styles. AI can generate this for themed pages (e.g. animations, custom fonts, glassmorphism).
          </p>
          <Textarea
            value={customCss}
            onChange={(e) => setCustomCss(e.target.value)}
            rows={6}
            placeholder={`<style>\n  /* Custom page styles */\n  .hero-glow { box-shadow: 0 0 60px rgba(0,255,0,0.3); }\n</style>`}
            className="bg-gray-800 border-gray-700 font-mono text-xs"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Accent Color Picker ────────────────────────────────────────────────────
function AccentColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div>
      <Label className="text-gray-400 text-xs">Accent Color</Label>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {ACCENT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={`w-7 h-7 rounded-full ${c.tw} border-2 transition-all ${
              value === c.value ? "border-white scale-110 ring-2 ring-white/20" : "border-transparent opacity-60 hover:opacity-100"
            }`}
            title={c.label}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Image Field with Pexels + Upload ───────────────────────────────────────

function ImageFieldWithBrowser({
  label,
  value,
  onChange,
  searchHint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  searchHint?: string;
}) {
  const [showBrowser, setShowBrowser] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("File must be an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("field", `lp-${Date.now()}`);
      const res = await fetch("/api/images/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onChange(data.path);
      toast.success("Image uploaded!");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Label className="text-gray-400 text-xs">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Image URL or upload..."
          className="bg-gray-800 border-gray-700 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowBrowser(true)}
          className="shrink-0 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
        >
          <Camera className="h-3.5 w-3.5 mr-1" />
          Pexels
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="shrink-0 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.item(0);
            if (f) handleUpload(f);
            e.target.value = "";
          }}
        />
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} className="shrink-0 text-red-400 hover:text-red-300">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Image Preview */}
      {value && (
        <div className="mt-2 relative rounded-lg overflow-hidden border border-gray-800 h-24 w-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}

      {showBrowser && (
        <PexelsImageBrowser
          currentUrl={value}
          defaultQuery={searchHint || "business trading"}
          onSelect={(url) => { onChange(url); setShowBrowser(false); }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  );
}

// ─── Section Editor ─────────────────────────────────────────────────────────
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
  const style = (content.style || {}) as Record<string, unknown>;
  const typeInfo = SECTION_TYPES.find((t) => t.type === section.type);
  const Icon = typeInfo?.icon || Code;
  const [collapsed, setCollapsed] = useState(false);

  function updateContent(key: string, value: unknown) {
    onUpdate(section.id, { content: { ...content, [key]: value } });
  }

  function updateStyle(key: string, value: unknown) {
    onUpdate(section.id, {
      content: { ...content, style: { ...style, [key]: value } },
    });
  }

  const accentColor = String(style.accentColor || "yellow");

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="py-3 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-gray-600" />
            <Icon className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-white capitalize">
              {section.type.replace(/-/g, " ")}
            </span>
            <Badge className="text-[10px] bg-gray-800 text-gray-500">#{index + 1}</Badge>
            {collapsed && (
              <span className="text-[10px] text-gray-600 ml-2 truncate max-w-[200px]">
                {String(content.headline || content.title || "")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={section.enabled !== false}
              onCheckedChange={(v) => onUpdate(section.id, { enabled: v })}
            />
            <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => onMove(section.id, "up")}>
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" disabled={index === total - 1} onClick={() => onMove(section.id, "down")}>
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onRemove(section.id)} className="text-red-400 hover:text-red-300">
              <Trash2 className="h-3 w-3" />
            </Button>
            {collapsed ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4 pt-0">
          {/* ── HERO ──────────────────────────────────────────── */}
          {section.type === "hero" && (
            <>
              <div>
                <Label className="text-gray-400 text-xs">Headline</Label>
                <Input value={String(content.headline || "")} onChange={(e) => updateContent("headline", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Subheadline</Label>
                <Textarea value={String(content.subheadline || "")} onChange={(e) => updateContent("subheadline", e.target.value)} rows={2} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Badge Text (optional)</Label>
                <Input value={String(content.badge || "")} onChange={(e) => updateContent("badge", e.target.value)} placeholder="🏆 #1 Trading Platform" className="bg-gray-800 border-gray-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-400 text-xs">CTA Text</Label>
                  <Input value={String(content.ctaText || "")} onChange={(e) => updateContent("ctaText", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">CTA URL</Label>
                  <Input value={String(content.ctaUrl || content.ctaLink || "")} onChange={(e) => updateContent("ctaUrl", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-400 text-xs">Secondary CTA Text</Label>
                  <Input value={String(content.secondaryCtaText || "")} onChange={(e) => updateContent("secondaryCtaText", e.target.value)} placeholder="Learn More" className="bg-gray-800 border-gray-700" />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Secondary CTA URL</Label>
                  <Input value={String(content.secondaryCtaUrl || content.secondaryCtaLink || "")} onChange={(e) => updateContent("secondaryCtaUrl", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
              </div>
              <ImageFieldWithBrowser label="Background Image" value={String(content.backgroundImage || "")} onChange={(url) => updateContent("backgroundImage", url)} searchHint="trading finance hero" />
              <div>
                <Label className="text-gray-400 text-xs">Background Gradient</Label>
                <Input value={String(content.backgroundGradient || "")} onChange={(e) => updateContent("backgroundGradient", e.target.value)} placeholder="from-slate-950 via-indigo-950 to-purple-950" className="bg-gray-800 border-gray-700" />
              </div>
              <AccentColorPicker value={accentColor} onChange={(c) => updateStyle("accentColor", c)} />
            </>
          )}

          {/* ── CTA ──────────────────────────────────────────── */}
          {section.type === "cta" && (
            <>
              <div>
                <Label className="text-gray-400 text-xs">Headline</Label>
                <Input value={String(content.headline || content.title || "")} onChange={(e) => updateContent("headline", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Subheadline</Label>
                <Textarea value={String(content.subheadline || content.subtitle || "")} onChange={(e) => updateContent("subheadline", e.target.value)} rows={2} className="bg-gray-800 border-gray-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-400 text-xs">CTA Text</Label>
                  <Input value={String(content.ctaText || "")} onChange={(e) => updateContent("ctaText", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">CTA URL</Label>
                  <Input value={String(content.ctaUrl || content.ctaLink || "")} onChange={(e) => updateContent("ctaUrl", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-400 text-xs">Secondary CTA Text</Label>
                  <Input value={String(content.secondaryCtaText || "")} onChange={(e) => updateContent("secondaryCtaText", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Secondary CTA URL</Label>
                  <Input value={String(content.secondaryCtaUrl || content.secondaryCtaLink || "")} onChange={(e) => updateContent("secondaryCtaUrl", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
              </div>
              <ImageFieldWithBrowser label="Background Image" value={String(content.backgroundImage || "")} onChange={(url) => updateContent("backgroundImage", url)} searchHint="abstract background dark" />
              <AccentColorPicker value={accentColor} onChange={(c) => updateStyle("accentColor", c)} />
            </>
          )}

          {/* ── FEATURES ─────────────────────────────────────── */}
          {section.type === "features" && (
            <>
              <div>
                <Label className="text-gray-400 text-xs">Title</Label>
                <Input value={String(content.headline || content.title || "")} onChange={(e) => updateContent("headline", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Subtitle</Label>
                <Input value={String(content.subtitle || content.subheadline || "")} onChange={(e) => updateContent("subtitle", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Layout</Label>
                <select
                  value={String(style.layout || "grid")}
                  onChange={(e) => updateStyle("layout", e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                >
                  <option value="grid">Grid (cards)</option>
                  <option value="alternating">Alternating (image + text)</option>
                </select>
              </div>
              <AccentColorPicker value={accentColor} onChange={(c) => updateStyle("accentColor", c)} />
              <ItemListEditor
                items={Array.isArray(content.items) ? content.items : []}
                onChange={(items) => updateContent("items", items)}
                fields={["title", "description", "icon", "image"]}
                labels={{ title: "Title", description: "Description", icon: "Icon (Lucide name)", image: "Image" }}
                imageFields={["image"]}
              />
            </>
          )}

          {/* ── STATS ────────────────────────────────────────── */}
          {section.type === "stats" && (
            <>
              <div>
                <Label className="text-gray-400 text-xs">Title</Label>
                <Input value={String(content.headline || content.title || "")} onChange={(e) => updateContent("headline", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Subtitle</Label>
                <Input value={String(content.subtitle || content.subheadline || "")} onChange={(e) => updateContent("subtitle", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <AccentColorPicker value={accentColor} onChange={(c) => updateStyle("accentColor", c)} />
              <ItemListEditor
                items={Array.isArray(content.items) ? content.items : []}
                onChange={(items) => updateContent("items", items)}
                fields={["value", "label", "icon"]}
                labels={{ value: "Value (e.g. $50K+)", label: "Label", icon: "Icon (Lucide name)" }}
              />
            </>
          )}

          {/* ── HOW IT WORKS ─────────────────────────────────── */}
          {section.type === "how-it-works" && (
            <>
              <div>
                <Label className="text-gray-400 text-xs">Title</Label>
                <Input value={String(content.headline || content.title || "")} onChange={(e) => updateContent("headline", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Subtitle</Label>
                <Input value={String(content.subtitle || content.subheadline || "")} onChange={(e) => updateContent("subtitle", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Layout</Label>
                <select
                  value={String(style.layout || "default")}
                  onChange={(e) => updateStyle("layout", e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                >
                  <option value="default">Vertical (stacked)</option>
                  <option value="horizontal">Horizontal (side by side)</option>
                </select>
              </div>
              <AccentColorPicker value={accentColor} onChange={(c) => updateStyle("accentColor", c)} />
              <ItemListEditor
                items={Array.isArray(content.steps) ? content.steps : []}
                onChange={(items) => updateContent("steps", items)}
                fields={["title", "description", "icon"]}
                labels={{ title: "Step Title", description: "Description", icon: "Icon (Lucide name)" }}
              />
            </>
          )}

          {/* ── TESTIMONIALS ─────────────────────────────────── */}
          {section.type === "testimonials" && (
            <>
              <div>
                <Label className="text-gray-400 text-xs">Title</Label>
                <Input value={String(content.headline || content.title || "")} onChange={(e) => updateContent("headline", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Subtitle</Label>
                <Input value={String(content.subtitle || content.subheadline || "")} onChange={(e) => updateContent("subtitle", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Layout</Label>
                <select
                  value={String(style.layout || "grid")}
                  onChange={(e) => updateStyle("layout", e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                >
                  <option value="grid">Grid (3 columns)</option>
                  <option value="cards">Cards (2 columns, larger)</option>
                </select>
              </div>
              <AccentColorPicker value={accentColor} onChange={(c) => updateStyle("accentColor", c)} />
              <ItemListEditor
                items={Array.isArray(content.items) ? content.items : []}
                onChange={(items) => updateContent("items", items)}
                fields={["name", "role", "quote", "rating"]}
                labels={{ name: "Name", role: "Title & Location", quote: "Testimonial", rating: "Rating (1-5)" }}
              />
            </>
          )}

          {/* ── FAQ ──────────────────────────────────────────── */}
          {section.type === "faq" && (
            <>
              <div>
                <Label className="text-gray-400 text-xs">Title</Label>
                <Input value={String(content.headline || content.title || "")} onChange={(e) => updateContent("headline", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Subtitle</Label>
                <Input value={String(content.subtitle || content.subheadline || "")} onChange={(e) => updateContent("subtitle", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <AccentColorPicker value={accentColor} onChange={(c) => updateStyle("accentColor", c)} />
              <ItemListEditor
                items={Array.isArray(content.items) ? content.items : []}
                onChange={(items) => updateContent("items", items)}
                fields={["question", "answer"]}
                labels={{ question: "Question", answer: "Answer" }}
                textareaFields={["answer"]}
              />
            </>
          )}

          {/* ── IMAGE-TEXT ────────────────────────────────────── */}
          {section.type === "image-text" && (
            <>
              <div>
                <Label className="text-gray-400 text-xs">Headline</Label>
                <Input value={String(content.headline || content.title || "")} onChange={(e) => updateContent("headline", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Subtitle / Eyebrow</Label>
                <Input value={String(content.subtitle || "")} onChange={(e) => updateContent("subtitle", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Description</Label>
                <Textarea value={String(content.description || content.text || "")} onChange={(e) => updateContent("description", e.target.value)} rows={3} className="bg-gray-800 border-gray-700" />
              </div>
              <ImageFieldWithBrowser label="Section Image" value={String(content.image || "")} onChange={(url) => updateContent("image", url)} searchHint="business professional" />
              <div>
                <Label className="text-gray-400 text-xs">Image Position</Label>
                <select
                  value={String(style.layout || "default")}
                  onChange={(e) => updateStyle("layout", e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                >
                  <option value="default">Image Left</option>
                  <option value="reversed">Image Right</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-400 text-xs">CTA Text</Label>
                  <Input value={String(content.ctaText || "")} onChange={(e) => updateContent("ctaText", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">CTA URL</Label>
                  <Input value={String(content.ctaUrl || content.ctaLink || "")} onChange={(e) => updateContent("ctaUrl", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
              </div>
              <AccentColorPicker value={accentColor} onChange={(c) => updateStyle("accentColor", c)} />
            </>
          )}

          {/* ── BANNER ───────────────────────────────────────── */}
          {section.type === "banner" && (
            <>
              <div>
                <Label className="text-gray-400 text-xs">Headline</Label>
                <Input value={String(content.headline || content.title || "")} onChange={(e) => updateContent("headline", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Subtitle</Label>
                <Input value={String(content.subtitle || content.subheadline || "")} onChange={(e) => updateContent("subtitle", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <ImageFieldWithBrowser label="Background Image" value={String(content.backgroundImage || "")} onChange={(url) => updateContent("backgroundImage", url)} searchHint="panoramic business cityscape" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-400 text-xs">CTA Text</Label>
                  <Input value={String(content.ctaText || "")} onChange={(e) => updateContent("ctaText", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">CTA URL</Label>
                  <Input value={String(content.ctaUrl || content.ctaLink || "")} onChange={(e) => updateContent("ctaUrl", e.target.value)} className="bg-gray-800 border-gray-700" />
                </div>
              </div>
              <AccentColorPicker value={accentColor} onChange={(c) => updateStyle("accentColor", c)} />
            </>
          )}

          {/* ── GALLERY ──────────────────────────────────────── */}
          {section.type === "gallery" && (
            <>
              <div>
                <Label className="text-gray-400 text-xs">Title</Label>
                <Input value={String(content.headline || content.title || "")} onChange={(e) => updateContent("headline", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Subtitle</Label>
                <Input value={String(content.subtitle || "")} onChange={(e) => updateContent("subtitle", e.target.value)} className="bg-gray-800 border-gray-700" />
              </div>
              <AccentColorPicker value={accentColor} onChange={(c) => updateStyle("accentColor", c)} />
              <GalleryItemEditor
                items={Array.isArray(content.items) ? content.items : []}
                onChange={(items) => updateContent("items", items)}
              />
            </>
          )}

          {/* ── CUSTOM HTML ──────────────────────────────────── */}
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
      )}
    </Card>
  );
}

// ─── Visual Item List Editor ────────────────────────────────────────────────
// Reason: Replaces raw JSON editing with a visual form for feature items,
// stats, testimonials, FAQ, and how-it-works steps.

function ItemListEditor({
  items,
  onChange,
  fields,
  labels,
  imageFields,
  textareaFields,
}: {
  items: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
  fields: string[];
  labels: Record<string, string>;
  imageFields?: string[];
  textareaFields?: string[];
}) {
  const imgFields = new Set(imageFields || []);
  const txtFields = new Set(textareaFields || []);
  // Reason: Use Map for safe dynamic key lookups (avoids ESLint object-injection-sink)
  const labelsMap = new Map(Object.entries(labels));

  function addItem() {
    const base = new Map<string, unknown>([["id", `item-${Date.now()}`]]);
    for (const f of fields) {
      base.set(f, "");
    }
    onChange([...items, Object.fromEntries(base)]);
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: string, value: unknown) {
    const updated = items.map((item, i) => {
      if (i !== idx) return item;
      const m = new Map(Object.entries(item));
      m.set(field, value);
      return Object.fromEntries(m);
    });
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-gray-400 text-xs">Items ({items.length})</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Item
        </Button>
      </div>
      {items.map((item, idx) => {
        const itemMap = new Map(Object.entries(item));
        return (
        <div key={String(itemMap.get("id") || idx)} className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-600 font-mono">Item #{idx + 1}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)} className="h-6 w-6 p-0 text-red-400 hover:text-red-300">
              <X className="h-3 w-3" />
            </Button>
          </div>
          {fields.map((field) => {
            const label = labelsMap.get(field) || field;
            const val = String(itemMap.get(field) ?? "");

            if (imgFields.has(field)) {
              return (
                <ImageFieldWithBrowser
                  key={field}
                  label={label}
                  value={val}
                  onChange={(url) => updateItem(idx, field, url)}
                  searchHint="business technology"
                />
              );
            }

            if (txtFields.has(field)) {
              return (
                <div key={field}>
                  <Label className="text-gray-500 text-[10px]">{label}</Label>
                  <Textarea
                    value={val}
                    onChange={(e) => updateItem(idx, field, e.target.value)}
                    rows={2}
                    className="bg-gray-800 border-gray-700 text-sm"
                  />
                </div>
              );
            }

            return (
              <div key={field}>
                <Label className="text-gray-500 text-[10px]">{label}</Label>
                <Input
                  value={val}
                  onChange={(e) => updateItem(idx, field, e.target.value)}
                  className="bg-gray-800 border-gray-700 text-sm h-8"
                />
              </div>
            );
          })}
        </div>
        );
      })}
      {items.length === 0 && (
        <p className="text-gray-600 text-xs text-center py-4">No items yet. Click &quot;Add Item&quot; to start.</p>
      )}
    </div>
  );
}

// ─── Gallery Item Editor (with image pickers) ───────────────────────────────

function GalleryItemEditor({
  items,
  onChange,
}: {
  items: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
}) {
  function addItem() {
    onChange([...items, { id: `gal-${Date.now()}`, image: "", title: "", description: "" }]);
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: string, value: string) {
    onChange(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-gray-400 text-xs">Gallery Images ({items.length})</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Image
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, idx) => (
          <div key={String(item.id || idx)} className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-600 font-mono">Image #{idx + 1}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)} className="h-6 w-6 p-0 text-red-400 hover:text-red-300">
                <X className="h-3 w-3" />
              </Button>
            </div>
            <ImageFieldWithBrowser
              label="Image"
              value={String(item.image || item.url || item.src || "")}
              onChange={(url) => updateItem(idx, "image", url)}
              searchHint="trading finance"
            />
            <div>
              <Label className="text-gray-500 text-[10px]">Title</Label>
              <Input
                value={String(item.title || "")}
                onChange={(e) => updateItem(idx, "title", e.target.value)}
                className="bg-gray-800 border-gray-700 text-sm h-8"
              />
            </div>
            <div>
              <Label className="text-gray-500 text-[10px]">Description</Label>
              <Input
                value={String(item.description || "")}
                onChange={(e) => updateItem(idx, "description", e.target.value)}
                className="bg-gray-800 border-gray-700 text-sm h-8"
              />
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <p className="text-gray-600 text-xs text-center py-4">No images yet. Click &quot;Add Image&quot; to start.</p>
      )}
    </div>
  );
}

// ─── Default Content Helpers ────────────────────────────────────────────────
function getDefaultContent(type: string): Record<string, unknown> {
  switch (type) {
    case "hero":
      return {
        headline: "Start Your Trading Journey",
        subheadline: "Join thousands of traders competing for real prizes",
        ctaText: "Sign Up Free",
        ctaUrl: "/sign-up",
        backgroundImage: "",
        backgroundGradient: "",
        badge: "",
        secondaryCtaText: "",
        secondaryCtaUrl: "",
        style: { accentColor: "yellow" },
      };
    case "features":
      return {
        headline: "Why Choose Us",
        subtitle: "",
        items: [
          { id: "f1", title: "Real-Time Trading", description: "Trade with live market data", icon: "TrendingUp", image: "" },
          { id: "f2", title: "Competitions", description: "Compete against other traders", icon: "Trophy", image: "" },
          { id: "f3", title: "Secure Platform", description: "Enterprise-grade security", icon: "Shield", image: "" },
        ],
        style: { accentColor: "yellow", layout: "grid" },
      };
    case "stats":
      return {
        headline: "Platform Stats",
        subtitle: "",
        items: [
          { id: "s1", value: "10K+", label: "Active Traders", icon: "Users" },
          { id: "s2", value: "€1M+", label: "Prize Pool", icon: "DollarSign" },
          { id: "s3", value: "50+", label: "Markets", icon: "Globe" },
          { id: "s4", value: "24/7", label: "Support", icon: "Clock" },
        ],
        style: { accentColor: "cyan" },
      };
    case "how-it-works":
      return {
        headline: "How It Works",
        subtitle: "",
        steps: [
          { id: "hw1", title: "Sign Up", description: "Create your free account in seconds", icon: "UserPlus" },
          { id: "hw2", title: "Join a Competition", description: "Choose from active competitions", icon: "Trophy" },
          { id: "hw3", title: "Trade & Win", description: "Trade with virtual funds and win real prizes", icon: "Award" },
        ],
        style: { accentColor: "violet", layout: "default" },
      };
    case "testimonials":
      return {
        headline: "What Traders Say",
        subtitle: "",
        items: [
          { id: "t1", name: "Alex T.", quote: "Best trading platform I've used!", rating: 5, role: "Day Trader" },
        ],
        style: { accentColor: "rose", layout: "grid" },
      };
    case "cta":
      return {
        headline: "Ready to Start Trading?",
        subheadline: "Join our community and compete for prizes",
        ctaText: "Get Started Now",
        ctaUrl: "/sign-up",
        backgroundImage: "",
        secondaryCtaText: "",
        secondaryCtaUrl: "",
        style: { accentColor: "blue" },
      };
    case "faq":
      return {
        headline: "Frequently Asked Questions",
        subtitle: "",
        items: [
          { id: "faq1", question: "Is it free to join?", answer: "Yes, you can create an account for free." },
        ],
        style: { accentColor: "teal" },
      };
    case "image-text":
      return {
        headline: "Engaging Content",
        subtitle: "",
        description: "Tell your story with an image and text side by side.",
        image: "",
        ctaText: "",
        ctaUrl: "",
        style: { accentColor: "indigo", layout: "default" },
      };
    case "banner":
      return {
        headline: "Special Offer",
        subtitle: "Limited time only",
        backgroundImage: "",
        ctaText: "Claim Now",
        ctaUrl: "/sign-up",
        style: { accentColor: "emerald" },
      };
    case "gallery":
      return {
        headline: "Gallery",
        subtitle: "",
        items: [],
        style: { accentColor: "orange" },
      };
    case "custom-html":
      return { html: "<div class='text-center py-8'><p>Custom content here</p></div>" };
    default:
      return {};
  }
}
