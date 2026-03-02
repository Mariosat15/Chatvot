"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  ExternalLink,
  Shield,
  Download,
  RefreshCw,
  X,
  Sparkles,
  Link2,
  CheckCircle2,
  Globe,
  Scale,
  Megaphone,
  LayoutGrid,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SitePageEditor, {
  getMainAppUrl,
  type SitePage,
  type PageSection,
} from "./SitePageEditor";

// ─── Template Configuration ──────────────────────────────────────────────────
// Reason: Structured templates with categories, descriptions, and visual
// metadata so the template chooser can render rich, informative cards.
interface TemplateItem {
  value: string;
  label: string;
  slug: string;
  icon: string;
  description: string;
  category: "legal" | "marketing" | "action_terms" | "other";
}

const PAGE_TEMPLATES: TemplateItem[] = [
  // Legal & Compliance
  { value: "terms", label: "Terms of Service", slug: "terms", icon: "📋", description: "Legal terms governing platform use, eligibility, and user obligations", category: "legal" },
  { value: "privacy", label: "Privacy Policy", slug: "privacy", icon: "🔒", description: "GDPR & CCPA compliant data collection and protection practices", category: "legal" },
  { value: "cookies", label: "Cookie Policy", slug: "cookie-policy", icon: "🍪", description: "Cookie usage, consent management, and tracking technologies", category: "legal" },
  { value: "refund", label: "Refund Policy", slug: "refund-policy", icon: "💳", description: "Refund conditions, cancellation terms, and chargeback rules", category: "legal" },
  { value: "aml", label: "AML / KYC Policy", slug: "aml-policy", icon: "🛡️", description: "Anti-Money Laundering compliance, sanctions screening, and KYC", category: "legal" },
  { value: "responsible-trading", label: "Responsible Trading", slug: "responsible-trading", icon: "⚖️", description: "Responsible participation guidelines, self-exclusion, and spending limits", category: "legal" },
  { value: "risk-disclaimer", label: "Risk Disclaimer", slug: "risk-disclaimer", icon: "⚠️", description: "Simulated trading risks, regulatory status, and liability limitations", category: "legal" },
  // Marketing & Information
  { value: "about", label: "About Us", slug: "about", icon: "🏢", description: "Company story, mission, team, and what the platform offers", category: "marketing" },
  { value: "contact", label: "Contact Us", slug: "contact", icon: "📧", description: "Support channels, business inquiries, complaint procedures", category: "marketing" },
  { value: "faq", label: "FAQ", slug: "faq", icon: "❓", description: "Frequently asked questions about the platform and trading", category: "marketing" },
  // Action Terms — shown to users before critical actions (purchase, withdrawal, etc.)
  { value: "terms-credit-purchase", label: "Credit Purchase Terms", slug: "terms-credit-purchase", icon: "💰", description: "Terms shown before buying credits — covers refunds, virtual currency, and charges", category: "action_terms" },
  { value: "terms-withdrawal", label: "Withdrawal Terms", slug: "terms-withdrawal", icon: "🏦", description: "Terms shown before withdrawing — covers KYC, fees, and processing", category: "action_terms" },
  { value: "terms-marketplace", label: "Marketplace Purchase Terms", slug: "terms-marketplace", icon: "🛒", description: "Terms shown before marketplace purchases — covers digital goods and licensing", category: "action_terms" },
  { value: "terms-competition-entry", label: "Competition Entry Terms", slug: "terms-competition-entry", icon: "🏆", description: "Terms shown before entering competitions — covers entry fees and rules", category: "action_terms" },
  { value: "terms-challenge", label: "Challenge Terms", slug: "terms-challenge", icon: "⚔️", description: "Terms shown before creating/accepting challenges — covers 1v1 rules and fees", category: "action_terms" },
  // Other
  { value: "custom", label: "Custom Page", slug: "", icon: "✏️", description: "Start from scratch with a blank page", category: "other" },
];

const TEMPLATE_CATEGORIES = [
  { key: "legal", label: "Legal & Compliance", icon: Scale, color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" },
  { key: "action_terms", label: "Action Terms (Popups)", icon: Shield, color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20" },
  { key: "marketing", label: "Marketing & Information", icon: Megaphone, color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" },
  { key: "other", label: "Other", icon: LayoutGrid, color: "text-gray-400", bgColor: "bg-gray-500/10", borderColor: "border-gray-500/20" },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────
export default function SitePagesSection() {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPage, setEditingPage] = useState<SitePage | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // ── Derived data ─────────────────────────────────────────────────────────
  const existingSlugs = useMemo(
    () => new Set(pages.map((p) => p.slug)),
    [pages],
  );

  const stats = useMemo(() => ({
    total: pages.length,
    active: pages.filter((p) => p.isActive).length,
    system: pages.filter((p) => p.isSystem).length,
    custom: pages.filter((p) => !p.isSystem).length,
  }), [pages]);

  // ── Fetch pages ──────────────────────────────────────────────────────────
  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/pages");
      const data = await res.json();
      if (data.success) setPages(data.pages);
      else toast.error(data.error || "Failed to load pages");
    } catch {
      toast.error("Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // ── CRUD Operations ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newSlug.trim() || !newTitle.trim()) {
      toast.error("Slug and title are required");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newSlug.trim(),
          title: newTitle.trim(),
          sections: [
            { id: "1", type: "heading", title: newTitle.trim(), content: "", order: 0 },
            { id: "2", type: "paragraph", content: "Page content goes here. Edit this section to add your content.", order: 1 },
          ],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Page created successfully");
        resetCreateForm();
        fetchPages();
      } else {
        toast.error(data.error || "Failed to create page");
      }
    } catch {
      toast.error("Failed to create page");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editingPage) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/pages/${editingPage.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPage),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Page saved successfully");
        setEditingPage(null);
        fetchPages();
      } else {
        toast.error(data.error || "Failed to save page");
      }
    } catch {
      toast.error("Failed to save page");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm("Are you sure you want to delete this page?")) return;
    try {
      const res = await fetch(`/api/pages/${slug}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { toast.success("Page deleted"); fetchPages(); }
      else toast.error(data.error || "Failed to delete page");
    } catch {
      toast.error("Failed to delete page");
    }
  };

  const handleToggleActive = async (page: SitePage) => {
    try {
      const res = await fetch(`/api/pages/${page.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !page.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Page ${!page.isActive ? "activated" : "deactivated"}`);
        fetchPages();
      }
    } catch {
      toast.error("Failed to update page status");
    }
  };

  const handleSaveDefaults = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/pages/save-defaults", { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success(data.message || "Defaults saved");
      else toast.error(data.error || "Failed to save defaults");
    } catch {
      toast.error("Failed to save defaults");
    } finally {
      setSaving(false);
    }
  };

  // ── Generate content ─────────────────────────────────────────────────────
  const handleGenerateContent = async (pageType: string, pageTitle?: string) => {
    try {
      setGenerating(true);
      const res = await fetch("/api/pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageType, pageTitle }),
      });
      const data = await res.json();
      if (data.success) return data;
      toast.error(data.error || "Failed to generate content");
      return null;
    } catch {
      toast.error("Failed to generate content");
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a page template");
      return;
    }
    const template = PAGE_TEMPLATES.find((t) => t.value === selectedTemplate);
    if (!template) return;

    const slug = selectedTemplate === "custom" ? newSlug.trim() : template.slug || newSlug.trim();
    const title = selectedTemplate === "custom" ? newTitle.trim() : newTitle.trim() || template.label;
    if (!slug) { toast.error("Slug is required"); return; }

    const generated = await handleGenerateContent(selectedTemplate, title);
    if (!generated) return;

    try {
      setSaving(true);
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title: generated.title || title,
          subtitle: generated.subtitle || "",
          sections: generated.sections || [],
          seoTitle: generated.seoTitle || "",
          seoDescription: generated.seoDescription || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`"${generated.title}" created with auto-generated content!`);
        resetCreateForm();
        fetchPages();
      } else {
        toast.error(data.error || "Failed to create page");
      }
    } catch {
      toast.error("Failed to create page");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateForEditor = async () => {
    if (!editingPage) return;
    const guessType = PAGE_TEMPLATES.find((t) => t.slug === editingPage.slug)?.value || "custom";
    const generated = await handleGenerateContent(guessType, editingPage.title);
    if (!generated) return;
    setEditingPage({
      ...editingPage,
      title: generated.title || editingPage.title,
      subtitle: generated.subtitle || editingPage.subtitle,
      sections: generated.sections || editingPage.sections,
      seoTitle: generated.seoTitle || editingPage.seoTitle,
      seoDescription: generated.seoDescription || editingPage.seoDescription,
    });
    toast.success("Content regenerated — review and save when ready");
  };

  // ── Section helpers ──────────────────────────────────────────────────────
  const addSection = (type: PageSection["type"]) => {
    if (!editingPage) return;
    const maxOrder = Math.max(0, ...editingPage.sections.map((s) => s.order));
    const newSection: PageSection = {
      id: Date.now().toString(),
      type,
      title: type === "heading" ? "New Heading" : "",
      content: type === "paragraph" ? "New paragraph content." : "",
      order: maxOrder + 1,
    };
    setEditingPage({ ...editingPage, sections: [...editingPage.sections, newSection] });
  };

  const updateSection = (id: string, updates: Partial<PageSection>) => {
    if (!editingPage) return;
    setEditingPage({
      ...editingPage,
      sections: editingPage.sections.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  };

  const removeSection = (id: string) => {
    if (!editingPage) return;
    setEditingPage({ ...editingPage, sections: editingPage.sections.filter((s) => s.id !== id) });
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    if (!editingPage) return;
    const sorted = [...editingPage.sections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === id);
    if ((direction === "up" && idx <= 0) || (direction === "down" && idx >= sorted.length - 1)) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    // Reason: Direct index access is safe here because bounds are validated above.
    const current = sorted.at(idx);
    const swap = sorted.at(swapIdx);
    if (!current || !swap) return;
    const tempOrder = current.order;
    current.order = swap.order;
    swap.order = tempOrder;
    setEditingPage({ ...editingPage, sections: sorted });
  };

  const resetCreateForm = () => {
    setShowCreate(false);
    setNewSlug("");
    setNewTitle("");
    setSelectedTemplate("");
  };

  // ── Render: Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Render: Page Editor ────────────────────────────────────────────────
  if (editingPage) {
    return (
      <SitePageEditor
        page={editingPage}
        saving={saving}
        generating={generating}
        onPageChange={setEditingPage}
        onSave={handleSave}
        onClose={() => setEditingPage(null)}
        onAddSection={addSection}
        onUpdateSection={updateSection}
        onRemoveSection={removeSection}
        onMoveSection={moveSection}
        onRegenerate={handleRegenerateForEditor}
      />
    );
  }

  // ── Render: Pages List ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header with Stats ─────────────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-400" />
                Site Pages
              </CardTitle>
              <CardDescription>
                Manage legal, informational, and custom pages for your platform.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleSaveDefaults} disabled={saving}>
                <Download className="h-4 w-4 mr-1" /> Save as Defaults
              </Button>
              <Button size="sm" variant="outline" onClick={fetchPages}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Page
              </Button>
            </div>
          </div>
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <StatBadge label="Total" value={stats.total} color="text-white" bg="bg-gray-800" />
            <StatBadge label="Active" value={stats.active} color="text-green-400" bg="bg-green-500/10" />
            <StatBadge label="System" value={stats.system} color="text-blue-400" bg="bg-blue-500/10" />
            <StatBadge label="Custom" value={stats.custom} color="text-purple-400" bg="bg-purple-500/10" />
          </div>
        </CardHeader>
      </Card>

      {/* ── Info Banner ───────────────────────────────────────────────── */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
        <Link2 className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-300">
          <p className="font-medium mb-1">Connected to Footer Links</p>
          <p className="text-blue-400/80 text-xs">
            Pages are automatically accessible at their URL (e.g.{" "}
            <code className="bg-blue-500/20 px-1 rounded">/terms</code>). To
            add them to the footer, go to{" "}
            <strong>Hero Page → Footer</strong>. Use{" "}
            <Sparkles className="h-3 w-3 inline text-yellow-400" />{" "}
            <strong>Generate from Template</strong> to auto-fill content with
            your company details.
          </p>
        </div>
      </div>

      {/* ── Create Page / Template Chooser ─────────────────────────────── */}
      {showCreate && (
        <Card className="bg-gray-900 border-blue-500/40 shadow-lg shadow-blue-500/5">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-400" />
                  Create New Page
                </CardTitle>
                <CardDescription>
                  Select a template to auto-generate professional content, or
                  create a blank page.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={resetCreateForm}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Template cards grouped by category */}
            {TEMPLATE_CATEGORIES.map((cat) => {
              const templates = PAGE_TEMPLATES.filter(
                (t) => t.category === cat.key,
              );
              if (templates.length === 0) return null;
              const CatIcon = cat.icon;
              return (
                <div key={cat.key}>
                  <div className="flex items-center gap-2 mb-3">
                    <CatIcon className={`h-4 w-4 ${cat.color}`} />
                    <span className={`text-sm font-semibold ${cat.color}`}>
                      {cat.label}
                    </span>
                    <div className="flex-1 h-px bg-gray-800" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {templates.map((t) => {
                      const exists = existingSlugs.has(t.slug);
                      const isSelected = selectedTemplate === t.value;
                      return (
                        <button
                          key={t.value}
                          onClick={() => {
                            setSelectedTemplate(t.value);
                            if (t.value !== "custom") {
                              setNewSlug(t.slug);
                              setNewTitle(t.label);
                            } else {
                              setNewSlug("");
                              setNewTitle("");
                            }
                          }}
                          className={`
                            relative text-left p-4 rounded-xl border transition-all duration-200
                            ${isSelected
                              ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/10"
                              : "border-gray-700/50 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/60"
                            }
                            ${exists && !isSelected ? "opacity-60" : ""}
                          `}
                        >
                          {/* Exists badge */}
                          {exists && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            </div>
                          )}
                          {/* Icon */}
                          <span className="text-2xl block mb-2">{t.icon}</span>
                          {/* Label */}
                          <span className="block text-sm font-medium text-white mb-1">
                            {t.label}
                          </span>
                          {/* Description */}
                          <span className="block text-xs text-gray-400 leading-relaxed line-clamp-2">
                            {t.description}
                          </span>
                          {/* Slug preview */}
                          {t.slug && (
                            <span className="block text-xs text-gray-600 mt-2 font-mono">
                              /{t.slug}
                            </span>
                          )}
                          {/* Exists info */}
                          {exists && (
                            <Badge
                              variant="outline"
                              className="mt-2 text-[10px] border-green-500/30 text-green-400"
                            >
                              Already created
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Slug + title + action bar */}
            <div className="border-t border-gray-800 pt-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-gray-400 text-xs">URL Slug</Label>
                  <Input
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="e.g. terms, refund-policy"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Page URL: <code>{getMainAppUrl()}/{newSlug || "your-slug"}</code>
                  </p>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Page Title</Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Terms of Service"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedTemplate ? (
                  <Button
                    onClick={handleCreateFromTemplate}
                    disabled={saving || generating}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {saving || generating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {generating ? "Generating content..." : "Generate & Create"}
                  </Button>
                ) : (
                  <Button onClick={handleCreate} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create Blank Page
                  </Button>
                )}
                <Button variant="ghost" onClick={resetCreateForm}>
                  Cancel
                </Button>
                {selectedTemplate && (
                  <p className="text-xs text-gray-500 ml-auto">
                    Content will be generated using your{" "}
                    <strong className="text-gray-400">Company Details</strong>{" "}
                    from Settings
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pages Grid ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {pages.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-16 text-center">
              <Globe className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400 text-lg font-medium mb-2">
                No pages yet
              </p>
              <p className="text-gray-500 text-sm mb-6">
                Create your first page to get started. Use templates for instant
                professional content.
              </p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create First Page
              </Button>
            </CardContent>
          </Card>
        ) : (
          pages.map((page) => {
            const templateInfo = PAGE_TEMPLATES.find(
              (t) => t.slug === page.slug,
            );
            return (
              <Card
                key={page.slug}
                className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all group"
              >
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Template icon or generic */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-800 border border-gray-700/50 flex items-center justify-center text-lg">
                      {templateInfo?.icon || "📄"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white truncate">
                          {page.title}
                        </span>
                        {page.isSystem && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1"
                          >
                            <Shield className="h-3 w-3" /> System
                          </Badge>
                        )}
                        {page.category === "action_terms" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 border-orange-500/30 text-orange-400"
                          >
                            ⚡ Action Popup
                          </Badge>
                        )}
                        <Badge
                          variant={page.isActive ? "default" : "outline"}
                          className={`text-[10px] ${
                            page.isActive
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "text-gray-500"
                          }`}
                        >
                          {page.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">
                          /{page.slug}
                        </code>
                        <span>{page.sections.length} sections</span>
                        {page.updatedAt && (
                          <span>
                            Updated{" "}
                            {new Date(page.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={page.isActive}
                      onCheckedChange={() => handleToggleActive(page)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        window.open(
                          `${getMainAppUrl()}/${page.slug}`,
                          "_blank",
                        )
                      }
                      title="Preview on main app"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingPage({ ...page })}
                      title="Edit page"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!page.isSystem && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(page.slug)}
                        className="text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete page"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Small stat badge component ──────────────────────────────────────────────
function StatBadge({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-lg px-3 py-2 text-center`}>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
