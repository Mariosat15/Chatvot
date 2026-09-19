"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  Search,
  Loader2,
  Copy,
  Tag,
  Sparkles,
  Bot,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Image from "next/image";
import type { LPTemplate } from "./lp-types";

interface Props {
  onSelectTemplate: (template: LPTemplate) => void;
  onAIEnhance?: (template: LPTemplate) => void;
  onBack: () => void;
}

const CATEGORY_COLORS = new Map([
  ["competition", "bg-purple-500/20 text-purple-400 border-purple-500/30"],
  ["trading", "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"],
  ["promotion", "bg-amber-500/20 text-amber-400 border-amber-500/30"],
  ["event", "bg-blue-500/20 text-blue-400 border-blue-500/30"],
  ["product", "bg-rose-500/20 text-rose-400 border-rose-500/30"],
]);

export default function LPTemplateGallery({ onSelectTemplate, onAIEnhance, onBack }: Props) {
  const [templates, setTemplates] = useState<LPTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const res = await fetch("/api/landing-pages/templates");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTemplates(data.templates || []);
      setCategories(data.categories || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let result = templates;
    if (filterCategory) {
      result = result.filter((t) => t.category === filterCategory);
    }
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(lower) ||
          t.description.toLowerCase().includes(lower) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(lower)),
      );
    }
    return result;
  }, [templates, filterCategory, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-yellow-500" />
            Template Gallery
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Choose a template to create a new landing page
          </p>
        </div>
        <Button variant="outline" onClick={onBack} size="sm">
          ← Back
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-gray-900 border-gray-700"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterCategory === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterCategory("")}
          >
            All ({templates.length})
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={filterCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterCategory(cat)}
              className="capitalize"
            >
              <Tag className="h-3 w-3 mr-1" />
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No templates found matching your criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template._id}
              template={template}
              onSelect={onSelectTemplate}
              onAIEnhance={onAIEnhance}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Template Card Sub-component ──────────────────────────────────────────────
function TemplateCard({
  template,
  onSelect,
  onAIEnhance,
}: {
  template: LPTemplate;
  onSelect: (t: LPTemplate) => void;
  onAIEnhance?: (t: LPTemplate) => void;
}) {
  const categoryClass =
    CATEGORY_COLORS.get(template.category) ||
    "bg-gray-500/20 text-gray-400 border-gray-500/30";

  return (
    <Card className="bg-gray-900 border-gray-800 hover:border-yellow-500/30 transition-all group overflow-hidden">
      {/* Thumbnail / Preview */}
      <div className="h-40 bg-gradient-to-br from-gray-800 via-gray-850 to-gray-900 relative overflow-hidden">
        {template.thumbnailUrl ? (
          <Image
            src={template.thumbnailUrl}
            alt={template.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-yellow-500/30 group-hover:text-yellow-500/60 transition-colors" />
          </div>
        )}

        {/* Overlay actions on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            size="sm"
            onClick={() => onSelect(template)}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-medium"
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Use Template
          </Button>
          {onAIEnhance && (
            <Button
              size="sm"
              onClick={() => onAIEnhance(template)}
              className="bg-violet-600 hover:bg-violet-500 text-white font-medium"
            >
              <Bot className="h-3.5 w-3.5 mr-1" />
              AI Enhance
            </Button>
          )}
        </div>

        {/* Category badge */}
        <Badge
          className={`absolute top-2 right-2 text-xs border ${categoryClass}`}
        >
          {template.category}
        </Badge>

        {template.isSystem && (
          <Badge className="absolute top-2 left-2 bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs border">
            System
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-white text-sm mb-1 truncate">
          {template.name}
        </h3>
        <p className="text-gray-500 text-xs line-clamp-2 mb-3">
          {template.description}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {(template.tags || []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded"
            >
              {tag}
            </span>
          ))}
          <span className="text-[10px] text-gray-600 ml-auto">
            {template.sections.length} sections
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
