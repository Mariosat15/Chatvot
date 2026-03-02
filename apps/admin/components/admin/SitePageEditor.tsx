"use client";

import {
  Save,
  Trash2,
  Pencil,
  Eye,
  ArrowUp,
  ArrowDown,
  Loader2,
  X,
  Type,
  AlignLeft,
  List,
  Minus,
  Code,
  Sparkles,
  GripVertical,
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// ─── Shared Types ────────────────────────────────────────────────────────────
export interface PageSection {
  id: string;
  type: "heading" | "paragraph" | "list" | "divider" | "html";
  title?: string;
  content: string;
  order: number;
}

export interface SitePage {
  _id?: string;
  slug: string;
  title: string;
  subtitle: string;
  sections: PageSection[];
  isActive: boolean;
  isSystem: boolean;
  seoTitle: string;
  seoDescription: string;
  category?: "legal" | "marketing" | "action_terms" | "other";
  updatedAt?: string;
}

const SECTION_TYPES = [
  { value: "heading", label: "Heading", icon: Type, color: "text-blue-400" },
  { value: "paragraph", label: "Paragraph", icon: AlignLeft, color: "text-gray-400" },
  { value: "list", label: "List", icon: List, color: "text-green-400" },
  { value: "divider", label: "Divider", icon: Minus, color: "text-gray-500" },
  { value: "html", label: "HTML", icon: Code, color: "text-orange-400" },
] as const;

/** Build the preview URL pointing to the main app (not admin). */
export function getMainAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    // Production: admin.chartvolt.com → chartvolt.com
    if (origin.includes("admin.")) {
      return origin.replace("admin.", "").replace(/\/+$/, "");
    }
    // Dev: localhost:3001 → localhost:3000
    return origin.replace(/:\d+$/, ":3000").replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface SitePageEditorProps {
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
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SitePageEditor({
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
}: SitePageEditorProps) {
  const sortedSections = [...page.sections].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <div className="space-y-6">
      {/* ── Editor Header ──────────────────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-400" />
                Editing: {page.title}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-gray-800 px-2 py-0.5 rounded">
                  /{page.slug}
                </code>
                <span>•</span>
                <span>
                  {page.isSystem ? "System page" : "Custom page"}
                </span>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onRegenerate}
                disabled={generating}
                className="border-yellow-500/40 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
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
                onClick={() =>
                  window.open(`${getMainAppUrl()}/${page.slug}`, "_blank")
                }
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

      {/* ── Page Details ───────────────────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm font-medium">
            Page Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400 text-xs">Page Title</Label>
              <Input
                value={page.title}
                onChange={(e) =>
                  onPageChange({ ...page, title: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Subtitle</Label>
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
              <Label className="text-gray-400 text-xs">SEO Title</Label>
              <Input
                value={page.seoTitle}
                onChange={(e) =>
                  onPageChange({ ...page, seoTitle: e.target.value })
                }
                className="mt-1"
                placeholder="Overrides page title in search results"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">SEO Description</Label>
              <Input
                value={page.seoDescription}
                onChange={(e) =>
                  onPageChange({ ...page, seoDescription: e.target.value })
                }
                className="mt-1"
                placeholder="Short description for search engines"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sections Editor ────────────────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-base">
                Content Sections
              </CardTitle>
              <CardDescription className="text-xs">
                {sortedSections.length} section{sortedSections.length !== 1 ? "s" : ""}
                {" — "}drag to reorder, click to edit
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {SECTION_TYPES.map((st) => (
                <Button
                  key={st.value}
                  size="sm"
                  variant="outline"
                  onClick={() => onAddSection(st.value)}
                  title={`Add ${st.label}`}
                  className="border-gray-700 hover:border-gray-600"
                >
                  <st.icon className={`h-3.5 w-3.5 mr-1 ${st.color}`} />
                  {st.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedSections.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-700/50 rounded-xl">
              <p className="text-gray-500 mb-2">No sections yet</p>
              <p className="text-xs text-gray-600">
                Use the buttons above to start building your page, or click
                <span className="text-yellow-400"> Regenerate</span> to
                auto-generate content.
              </p>
            </div>
          ) : (
            sortedSections.map((section, idx) => (
              <SectionBlock
                key={section.id}
                section={section}
                index={idx}
                total={sortedSections.length}
                onUpdate={onUpdateSection}
                onRemove={onRemoveSection}
                onMove={onMoveSection}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Section Block Sub-Component ─────────────────────────────────────────────
// Reason: Extracted to keep the editor component clean and each section self-
// contained with its own editing UI.
function SectionBlock({
  section,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  section: PageSection;
  index: number;
  total: number;
  onUpdate: (id: string, updates: Partial<PageSection>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  const typeInfo = SECTION_TYPES.find((t) => t.value === section.type);
  const Icon = typeInfo?.icon || AlignLeft;
  const color = typeInfo?.color || "text-gray-400";

  return (
    <div className="group border border-gray-700/50 rounded-lg bg-gray-800/20 hover:bg-gray-800/40 transition-colors">
      {/* Section header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/30">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-gray-600" />
          <Icon className={`h-4 w-4 ${color}`} />
          <Badge
            variant="outline"
            className="text-xs capitalize border-gray-700"
          >
            {section.type}
          </Badge>
          <span className="text-xs text-gray-500">#{index + 1}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onMove(section.id, "up")}
            disabled={index === 0}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onMove(section.id, "down")}
            disabled={index === total - 1}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-500 hover:text-red-400"
            onClick={() => onRemove(section.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Section content */}
      <div className="p-4">
        {section.type === "heading" && (
          <Input
            value={section.title || ""}
            onChange={(e) =>
              onUpdate(section.id, { title: e.target.value })
            }
            placeholder="Heading text"
            className="font-bold text-base"
          />
        )}
        {section.type === "paragraph" && (
          <Textarea
            value={section.content}
            onChange={(e) =>
              onUpdate(section.id, { content: e.target.value })
            }
            placeholder="Paragraph content"
            rows={3}
            className="text-sm"
          />
        )}
        {section.type === "list" && (
          <div>
            <Textarea
              value={section.content}
              onChange={(e) =>
                onUpdate(section.id, { content: e.target.value })
              }
              placeholder="One item per line"
              rows={4}
              className="text-sm"
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
              onUpdate(section.id, { content: e.target.value })
            }
            placeholder="<p>Custom HTML content</p>"
            rows={4}
            className="font-mono text-sm"
          />
        )}
        {section.type === "divider" && (
          <div className="py-2">
            <hr className="border-gray-600 border-dashed" />
            <p className="text-xs text-gray-600 text-center mt-1">
              Horizontal divider
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
