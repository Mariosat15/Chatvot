"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { playerGamePageHref } from "@/lib/admin/player-app-url";

/**
 * Thin merchandising controls for one GameCatalogueEntry.
 *
 * Does NOT edit names, rules or artwork — those stay on provider_game / trading page
 * content. Slug is permanent after create (read-only here).
 *
 * Model-free client component (R58): talks to /api/games/catalogue/[gameKey] only.
 */

export interface CatalogueMerchandisingState {
  slug: string;
  gameKey: string;
  sortOrder: number;
  isFeatured: boolean;
  isVisible: boolean;
  comingSoon: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

interface Props {
  gameKey: string;
  /** Fallback slug for the View page link before load (usually gameCode / trading). */
  fallbackSlug?: string;
  onSlugKnown?: (slug: string) => void;
}

function endpoint(gameKey: string): string {
  return `/api/games/catalogue/${encodeURIComponent(gameKey)}`;
}

export default function CatalogueMerchandisingPanel({
  gameKey,
  fallbackSlug,
  onSlugKnown,
}: Props) {
  const [state, setState] = useState<CatalogueMerchandisingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint(gameKey));
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not load merchandising.");
        setState(null);
        return;
      }
      const m = data.merchandising as CatalogueMerchandisingState;
      setState(m);
      setSeoTitle(m.seoTitle ?? "");
      setSeoDescription(m.seoDescription ?? "");
      onSlugKnown?.(m.slug);
    } catch {
      toast.error("Something went wrong. Please contact support.");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [gameKey, onSlugKnown]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const response = await fetch(endpoint(gameKey), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not save merchandising.");
        return;
      }
      const m = data.merchandising as CatalogueMerchandisingState;
      setState(m);
      setSeoTitle(m.seoTitle ?? "");
      setSeoDescription(m.seoDescription ?? "");
      onSlugKnown?.(m.slug);
      toast.success("Merchandising saved.");
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-white/40">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading merchandising…
      </div>
    );
  }

  if (!state) {
    return (
      <p className="text-xs text-white/45">
        No catalogue entry yet. Enable the title (or wait for sync), then reopen.
      </p>
    );
  }

  const pageSlug = state.slug || fallbackSlug || gameKey;

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-white/50">Catalogue slug (permanent)</Label>
        <p className="mt-1 font-mono text-sm text-white/80">{state.slug}</p>
        <p className="mt-1 text-[11px] text-white/35">
          Player URL:{" "}
          <span className="text-white/55">{playerGamePageHref(pageSlug)}</span>
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm text-white">Visible on /games</Label>
          <p className="text-[11px] text-white/40">
            Hidden titles stay reachable via direct contest links.
          </p>
        </div>
        <Switch
          checked={state.isVisible}
          disabled={saving}
          onCheckedChange={(v) => void patch({ isVisible: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm text-white">Featured</Label>
          <p className="text-[11px] text-white/40">Hub featured section.</p>
        </div>
        <Switch
          checked={state.isFeatured}
          disabled={saving}
          onCheckedChange={(v) => void patch({ isFeatured: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm text-white">Coming soon</Label>
          <p className="text-[11px] text-white/40">
            Shown on the hub; game page has no join CTAs.
          </p>
        </div>
        <Switch
          checked={state.comingSoon}
          disabled={saving}
          onCheckedChange={(v) => void patch({ comingSoon: v })}
        />
      </div>

      <div>
        <Label htmlFor={`sort-${gameKey}`} className="text-sm text-white">
          Sort order
        </Label>
        <p className="mb-1 text-[11px] text-white/40">
          Lower numbers appear first on /games.
        </p>
        <Input
          id={`sort-${gameKey}`}
          type="number"
          className="max-w-[8rem] border-gray-600 bg-gray-900"
          value={state.sortOrder}
          disabled={saving}
          onChange={(e) => {
            const n = Number(e.target.value);
            setState((s) => (s ? { ...s, sortOrder: n } : s));
          }}
          onBlur={() => {
            if (
              typeof state.sortOrder !== "number" ||
              !Number.isFinite(state.sortOrder)
            ) {
              void load();
              return;
            }
            void patch({ sortOrder: state.sortOrder });
          }}
        />
      </div>

      <div className="space-y-2 border-t border-gray-700/80 pt-3">
        <Label className="text-xs text-white/50">Optional SEO override</Label>
        <Input
          placeholder="SEO title"
          className="border-gray-600 bg-gray-900"
          value={seoTitle}
          disabled={saving}
          onChange={(e) => setSeoTitle(e.target.value)}
          onBlur={() => {
            if ((state.seoTitle ?? "") === seoTitle.trim()) return;
            void patch({ seoTitle: seoTitle.trim() || null });
          }}
        />
        <Textarea
          placeholder="SEO description"
          className="min-h-[72px] border-gray-600 bg-gray-900"
          value={seoDescription}
          disabled={saving}
          onChange={(e) => setSeoDescription(e.target.value)}
          onBlur={() => {
            if ((state.seoDescription ?? "") === seoDescription.trim()) return;
            void patch({ seoDescription: seoDescription.trim() || null });
          }}
        />
      </div>
    </div>
  );
}
