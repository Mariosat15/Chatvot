"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Save,
  Plus,
  Trash2,
  Pencil,
  Eye,
  ArrowUp,
  ArrowDown,
  Loader2,
  ExternalLink,
  Shield,
  Download,
  RefreshCw,
  X,
  Type,
  AlignLeft,
  List,
  Minus,
  Code,
  Sparkles,
  Link2,
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
interface PageSection {
  id: string;
  type: "heading" | "paragraph" | "list" | "divider" | "html";
  title?: string;
  content: string;
  order: number;
}

interface SitePage {
  _id?: string;
  slug: string;
  title: string;
  subtitle: string;
  sections: PageSection[];
  isActive: boolean;
  isSystem: boolean;
  seoTitle: string;
  seoDescription: string;
  updatedAt?: string;
}

const SECTION_TYPES = [
  { value: "heading", label: "Heading", icon: Type },
  { value: "paragraph", label: "Paragraph", icon: AlignLeft },
  { value: "list", label: "List", icon: List },
  { value: "divider", label: "Divider", icon: Minus },
  { value: "html", label: "HTML", icon: Code },
] as const;

// ── Page type templates available for AI generation ─────────────────────────
const PAGE_TEMPLATES = [
  { value: "terms", label: "Terms of Service", slug: "terms" },
  { value: "privacy", label: "Privacy Policy", slug: "privacy" },
  { value: "refund", label: "Refund Policy", slug: "refund-policy" },
  { value: "aml", label: "AML Policy", slug: "aml-policy" },
  {
    value: "responsible-trading",
    label: "Responsible Trading",
    slug: "responsible-trading",
  },
  { value: "about", label: "About Us", slug: "about" },
  { value: "contact", label: "Contact Us", slug: "contact" },
  { value: "faq", label: "FAQ", slug: "faq" },
  { value: "cookies", label: "Cookie Policy", slug: "cookie-policy" },
  { value: "custom", label: "Custom Page", slug: "" },
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

  // ── Fetch pages ─────────────────────────────────────────────────────────────
  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/pages");
      const data = await res.json();
      if (data.success) {
        setPages(data.pages);
      } else {
        toast.error(data.error || "Failed to load pages");
      }
    } catch {
      toast.error("Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // ── Create page ─────────────────────────────────────────────────────────────
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
            {
              id: "1",
              type: "heading",
              title: newTitle.trim(),
              content: "",
              order: 0,
            },
            {
              id: "2",
              type: "paragraph",
              content: "Page content goes here. Edit this section to add your content.",
              order: 1,
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Page created successfully");
        setShowCreate(false);
        setNewSlug("");
        setNewTitle("");
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

  // ── Save page ───────────────────────────────────────────────────────────────
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

  // ── Delete page ─────────────────────────────────────────────────────────────
  const handleDelete = async (slug: string) => {
    if (!confirm("Are you sure you want to delete this page?")) return;
    try {
      const res = await fetch(`/api/pages/${slug}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Page deleted");
        fetchPages();
      } else {
        toast.error(data.error || "Failed to delete page");
      }
    } catch {
      toast.error("Failed to delete page");
    }
  };

  // ── Toggle active ──────────────────────────────────────────────────────────
  const handleToggleActive = async (page: SitePage) => {
    try {
      const res = await fetch(`/api/pages/${page.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !page.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Page ${!page.isActive ? "activated" : "deactivated"}`,
        );
        fetchPages();
      }
    } catch {
      toast.error("Failed to update page status");
    }
  };

  // ── Save as defaults ───────────────────────────────────────────────────────
  const handleSaveDefaults = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/pages/save-defaults", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Defaults saved");
      } else {
        toast.error(data.error || "Failed to save defaults");
      }
    } catch {
      toast.error("Failed to save defaults");
    } finally {
      setSaving(false);
    }
  };

  // ── Generate content from template + company details ────────────────────
  const handleGenerateContent = async (
    pageType: string,
    pageTitle?: string,
  ) => {
    try {
      setGenerating(true);
      const res = await fetch("/api/pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageType, pageTitle }),
      });
      const data = await res.json();
      if (data.success) {
        return data;
      } else {
        toast.error(data.error || "Failed to generate content");
        return null;
      }
    } catch {
      toast.error("Failed to generate content");
      return null;
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Create a new page from a selected template.
   * Generates content using company details, then creates the page.
   */
  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a page template");
      return;
    }

    const template = PAGE_TEMPLATES.find((t) => t.value === selectedTemplate);
    if (!template) return;

    const slug =
      selectedTemplate === "custom"
        ? newSlug.trim()
        : template.slug || newSlug.trim();
    const title =
      selectedTemplate === "custom"
        ? newTitle.trim()
        : newTitle.trim() || template.label;

    if (!slug) {
      toast.error("Slug is required");
      return;
    }

    // Generate content
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
        toast.success(
          `"${generated.title}" created with auto-generated content!`,
        );
        setShowCreate(false);
        setNewSlug("");
        setNewTitle("");
        setSelectedTemplate("");
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

  /**
   * Regenerate content for an existing page being edited.
   */
  const handleRegenerateForEditor = async () => {
    if (!editingPage) return;

    // Guess page type from slug
    const guessType =
      PAGE_TEMPLATES.find((t) => t.slug === editingPage.slug)?.value ||
      "custom";

    const generated = await handleGenerateContent(
      guessType,
      editingPage.title,
    );
    if (!generated) return;

    setEditingPage({
      ...editingPage,
      title: generated.title || editingPage.title,
      subtitle: generated.subtitle || editingPage.subtitle,
      sections: generated.sections || editingPage.sections,
      seoTitle: generated.seoTitle || editingPage.seoTitle,
      seoDescription: generated.seoDescription || editingPage.seoDescription,
    });

    toast.success(
      "Content regenerated from template — review and save when ready",
    );
  };

  // ── Section helpers ────────────────────────────────────────────────────────
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
    setEditingPage({
      ...editingPage,
      sections: [...editingPage.sections, newSection],
    });
  };

  const updateSection = (id: string, updates: Partial<PageSection>) => {
    if (!editingPage) return;
    setEditingPage({
      ...editingPage,
      sections: editingPage.sections.map((s) =>
        s.id === id ? { ...s, ...updates } : s,
      ),
    });
  };

  const removeSection = (id: string) => {
    if (!editingPage) return;
    setEditingPage({
      ...editingPage,
      sections: editingPage.sections.filter((s) => s.id !== id),
    });
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    if (!editingPage) return;
    const sorted = [...editingPage.sections].sort(
      (a, b) => a.order - b.order,
    );
    const idx = sorted.findIndex((s) => s.id === id);
    if (
      (direction === "up" && idx <= 0) ||
      (direction === "down" && idx >= sorted.length - 1)
    )
      return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const temp = sorted[idx]!.order;
    sorted[idx]!.order = sorted[swapIdx]!.order;
    sorted[swapIdx]!.order = temp;
    setEditingPage({ ...editingPage, sections: sorted });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Page Editor View ───────────────────────────────────────────────────────
  if (editingPage) {
    return (
      <PageEditor
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

  // ── Pages List View ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-400" />
                Site Pages
              </CardTitle>
              <CardDescription>
                Manage legal, informational, and custom pages. These are
                accessible from footer links and direct URLs.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveDefaults}
                disabled={saving}
              >
                <Download className="h-4 w-4 mr-1" />
                Save as Defaults
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchPages}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Page
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Info: Connection to Footer Links */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
        <Link2 className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-300">
          <p className="font-medium mb-1">
            Connected to Footer Links
          </p>
          <p className="text-blue-400/80 text-xs">
            Pages created here are automatically available at their URL (e.g.{" "}
            <code className="bg-blue-500/20 px-1 rounded">/terms</code>).
            To show them in the landing page footer, add a matching link in{" "}
            <strong>Hero Page → Footer</strong> section. Use{" "}
            <Sparkles className="h-3 w-3 inline text-yellow-400" />{" "}
            <strong>Generate from Template</strong> to auto-fill page content
            using your company details from Settings → Company.
          </p>
        </div>
      </div>

      {/* Create Page Dialog */}
      {showCreate && (
        <Card className="bg-gray-900 border-blue-500/50">
          <CardContent className="pt-6 space-y-4">
            {/* Template selector */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                Generate from Template
                <span className="text-xs text-gray-500 font-normal">
                  (uses your company details to fill content)
                </span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {PAGE_TEMPLATES.map((t) => (
                  <Button
                    key={t.value}
                    size="sm"
                    variant={
                      selectedTemplate === t.value ? "default" : "outline"
                    }
                    className={
                      selectedTemplate === t.value
                        ? "bg-blue-600"
                        : "border-gray-600"
                    }
                    onClick={() => {
                      setSelectedTemplate(t.value);
                      if (t.value !== "custom") {
                        setNewSlug(t.slug);
                        setNewTitle(t.label);
                      }
                    }}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Slug + title fields */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label>URL Slug</Label>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="e.g. terms, refund-policy, about"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be the URL path: /{newSlug || "your-slug"}
                </p>
              </div>
              <div className="flex-1">
                <Label>Page Title</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Terms of Service"
                  className="mt-1"
                />
              </div>

              {/* Create buttons */}
              <div className="flex gap-2">
                {selectedTemplate ? (
                  <Button
                    onClick={handleCreateFromTemplate}
                    disabled={saving || generating}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {saving || generating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    {generating ? "Generating..." : "Generate & Create"}
                  </Button>
                ) : (
                  <Button onClick={handleCreate} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Create Blank
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCreate(false);
                    setNewSlug("");
                    setNewTitle("");
                    setSelectedTemplate("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pages Grid */}
      <div className="grid gap-4">
        {pages.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-10 text-center text-gray-400">
              No pages yet. Create your first page to get started.
            </CardContent>
          </Card>
        ) : (
          pages.map((page) => (
            <Card
              key={page.slug}
              className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors"
            >
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">
                        {page.title}
                      </span>
                      {page.isSystem && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          System
                        </Badge>
                      )}
                      <Badge
                        variant={page.isActive ? "default" : "outline"}
                        className="text-xs"
                      >
                        {page.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>/{page.slug}</span>
                      <span>•</span>
                      <span>{page.sections.length} sections</span>
                      {page.updatedAt && (
                        <>
                          <span>•</span>
                          <span>
                            Updated{" "}
                            {new Date(page.updatedAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Switch
                    checked={page.isActive}
                    onCheckedChange={() => handleToggleActive(page)}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      window.open(`/${page.slug}`, "_blank")
                    }
                    title="Preview page"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingPage({ ...page })}
                    title="Edit page"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!page.isSystem && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(page.slug)}
                      className="text-red-500 hover:text-red-400"
                      title="Delete page"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page Editor Sub-Component ───────────────────────────────────────────────
function PageEditor({
  page,
  saving,
  generating,
  onPageChange,
  onSave,
  onClose,
  onAddSection,
  onUpdateSection,
  onRemoveSection,
  onMoveSection,
  onRegenerate,
}: {
  page: SitePage;
  saving: boolean;
  generating: boolean;
  onPageChange: (p: SitePage) => void;
  onSave: () => void;
  onClose: () => void;
  onAddSection: (type: PageSection["type"]) => void;
  onUpdateSection: (id: string, updates: Partial<PageSection>) => void;
  onRemoveSection: (id: string) => void;
  onMoveSection: (id: string, direction: "up" | "down") => void;
  onRegenerate: () => void;
}) {
  const sortedSections = [...page.sections].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <div className="space-y-6">
      {/* Editor Header */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-400" />
                Editing: {page.title}
              </CardTitle>
              <CardDescription>
                /{page.slug} — {page.isSystem ? "System page" : "Custom page"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onRegenerate}
                disabled={generating}
                className="border-yellow-500/40 text-yellow-400 hover:text-yellow-300"
                title="Regenerate content from template using company details"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                {generating ? "Generating..." : "Regenerate"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/${page.slug}`, "_blank")}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Page Details */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Page Title</Label>
              <Input
                value={page.title}
                onChange={(e) =>
                  onPageChange({ ...page, title: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input
                value={page.subtitle}
                onChange={(e) =>
                  onPageChange({ ...page, subtitle: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>SEO Title</Label>
              <Input
                value={page.seoTitle}
                onChange={(e) =>
                  onPageChange({ ...page, seoTitle: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>SEO Description</Label>
              <Input
                value={page.seoDescription}
                onChange={(e) =>
                  onPageChange({ ...page, seoDescription: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections Editor */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base">
              Content Sections
            </CardTitle>
            <div className="flex gap-1">
              {SECTION_TYPES.map((st) => (
                <Button
                  key={st.value}
                  size="sm"
                  variant="outline"
                  onClick={() => onAddSection(st.value)}
                  title={`Add ${st.label}`}
                >
                  <st.icon className="h-3.5 w-3.5 mr-1" />
                  {st.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedSections.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No sections yet. Add a section above to start building your
              page.
            </p>
          ) : (
            sortedSections.map((section, idx) => (
              <div
                key={section.id}
                className="border border-gray-700/50 rounded-lg p-4 space-y-2 bg-gray-800/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {section.type}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onMoveSection(section.id, "up")}
                      disabled={idx === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onMoveSection(section.id, "down")}
                      disabled={idx === sortedSections.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500 hover:text-red-400"
                      onClick={() => onRemoveSection(section.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Section-type-specific editing */}
                {section.type === "heading" && (
                  <Input
                    value={section.title || ""}
                    onChange={(e) =>
                      onUpdateSection(section.id, {
                        title: e.target.value,
                      })
                    }
                    placeholder="Heading text"
                    className="font-bold"
                  />
                )}
                {section.type === "paragraph" && (
                  <Textarea
                    value={section.content}
                    onChange={(e) =>
                      onUpdateSection(section.id, {
                        content: e.target.value,
                      })
                    }
                    placeholder="Paragraph content"
                    rows={3}
                  />
                )}
                {section.type === "list" && (
                  <div>
                    <Textarea
                      value={section.content}
                      onChange={(e) =>
                        onUpdateSection(section.id, {
                          content: e.target.value,
                        })
                      }
                      placeholder="One item per line"
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter one list item per line.
                    </p>
                  </div>
                )}
                {section.type === "html" && (
                  <Textarea
                    value={section.content}
                    onChange={(e) =>
                      onUpdateSection(section.id, {
                        content: e.target.value,
                      })
                    }
                    placeholder="<p>Custom HTML content</p>"
                    rows={4}
                    className="font-mono text-sm"
                  />
                )}
                {section.type === "divider" && (
                  <hr className="border-gray-600" />
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
