"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CONTENT_LIMITS } from "@/lib/admin/game-content-fields";
import {
  listGamePageThemes,
  resolveGamePageTheme,
  type GamePageThemeId,
} from "@/lib/services/games/game-page-themes";
import { normaliseCategorySlug } from "@/lib/services/games/game-categories";
import type { ProviderTitleRow } from "./provider-types";

/**
 * Pick a ready-made player page theme and edit layout fields for All Games.
 */

interface Props {
  title: ProviderTitleRow;
  onSaved: (patch: Partial<ProviderTitleRow>) => void;
  /**
   * Override the content PATCH URL. Trading uses `/api/games/trading/page-content`
   * and sends `{ content }` with no `gameCode`.
   */
  contentEndpoint?: string;
}

function hydrateFromTitle(title: ProviderTitleRow) {
  const categorySlug = normaliseCategorySlug(title.category);
  const resolved = resolveGamePageTheme(title.pageThemeId, categorySlug);
  return {
    themeId: title.pageThemeId || resolved.id,
    quote: title.stylizedQuote ?? "",
    skill: title.skillLevelLabel ?? "All Levels",
    desktop: title.supportedDevices?.desktop !== false,
    tablet: title.supportedDevices?.tablet !== false,
    mobile: title.supportedDevices?.mobile !== false,
    tags: (title.descriptionTags ?? []).join(", "),
  };
}

export default function GamePageThemeEditor({
  title,
  onSaved,
  contentEndpoint,
}: Props) {
  const initial = hydrateFromTitle(title);
  const [themeId, setThemeId] = useState<string>(initial.themeId);
  const [quote, setQuote] = useState(initial.quote);
  const [skill, setSkill] = useState(initial.skill);
  const [desktop, setDesktop] = useState(initial.desktop);
  const [tablet, setTablet] = useState(initial.tablet);
  const [mobile, setMobile] = useState(initial.mobile);
  const [tags, setTags] = useState(initial.tags);
  const [saving, setSaving] = useState(false);

  // Reason: without this, switching titles in All Games keeps the previous
  // title's local state and Save writes it onto the newly selected game
  // (production report 21 Sep 2026 — "theme is the same for all games").
  // `title` is the dependency (not a field list) so a post-save patch also
  // rehydrates; remount via key={gameKey} covers the switch case either way.
  useEffect(() => {
    const next = hydrateFromTitle(title);
    setThemeId(next.themeId);
    setQuote(next.quote);
    setSkill(next.skill);
    setDesktop(next.desktop);
    setTablet(next.tablet);
    setMobile(next.mobile);
    setTags(next.tags);
  }, [title]);

  async function save() {
    setSaving(true);
    try {
      const descriptionTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, CONTENT_LIMITS.descriptionTags);

      const content = {
        pageThemeId: themeId,
        stylizedQuote: quote.trim(),
        skillLevelLabel: skill.trim(),
        supportedDevices: { desktop, tablet, mobile },
        descriptionTags,
      };

      const endpoint =
        contentEndpoint ??
        `/api/games/providers/${title.providerKey}/games/content`;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          contentEndpoint
            ? { content }
            : { gameCode: title.gameCode, content },
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }
      onSaved({
        pageThemeId: content.pageThemeId as GamePageThemeId,
        stylizedQuote: content.stylizedQuote || undefined,
        skillLevelLabel: content.skillLevelLabel || undefined,
        supportedDevices: content.supportedDevices,
        descriptionTags: content.descriptionTags,
      });
      toast.success("Page theme saved.");
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-gray-700 bg-gray-800/50 p-5 shadow-none">
        <h3 className="text-sm font-semibold text-white">Page theme</h3>
        <p className="mt-1 text-xs text-white/50">
          Ready-made looks for the player game page. Circuit Neon matches the
          Circuit Sprint reference. Clearing the choice is done by picking
          ChartVolt Classic or another category theme.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {listGamePageThemes().map((theme) => {
            const selected = themeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setThemeId(theme.id)}
                className={
                  selected
                    ? "rounded-xl border-2 border-violet-500 bg-gray-900/80 p-3 text-left"
                    : "rounded-xl border border-gray-700 bg-gray-900/40 p-3 text-left hover:border-gray-500"
                }
              >
                <p className="text-sm font-semibold text-white">{theme.label}</p>
                <p className="mt-1 text-[11px] text-white/50">
                  {theme.description}
                </p>
                <div className="mt-3 flex gap-1.5">
                  {[
                    theme.cssVars["--gp-accent"],
                    theme.cssVars["--gp-accent2"],
                    theme.cssVars["--gp-accent3"],
                    theme.cssVars["--gp-cta-from"],
                  ].map((color) => (
                    <span
                      key={color}
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="border-gray-700 bg-gray-800/50 p-5 shadow-none">
        <h3 className="text-sm font-semibold text-white">Hero & info</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Stylized quote</Label>
            <Input
              value={quote}
              maxLength={CONTENT_LIMITS.stylizedQuote}
              placeholder="EVERY MOVE COUNTS"
              className="border-gray-700 bg-gray-900 text-white"
              onChange={(e) => setQuote(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Skill level label</Label>
            <Input
              value={skill}
              maxLength={CONTENT_LIMITS.skillLevelLabel}
              className="border-gray-700 bg-gray-900 text-white"
              onChange={(e) => setSkill(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-white/60">
              Description tags (comma-separated)
            </Label>
            <Input
              value={tags}
              placeholder="Logic, Strategy, Fast Paced"
              className="border-gray-700 bg-gray-900 text-white"
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          {(
            [
              ["Desktop", desktop, setDesktop],
              ["Tablet", tablet, setTablet],
              ["Mobile", mobile, setMobile],
            ] as const
          ).map(([label, value, set]) => (
            <label key={label} className="flex items-center gap-2 text-sm text-white/80">
              <Switch checked={value} onCheckedChange={set} />
              {label}
            </label>
          ))}
        </div>
      </Card>

      <p className="text-xs text-white/45">
        How it works steps, game tips and their pictures live on the{" "}
        <strong className="font-medium text-white/65">How it works & tips</strong>{" "}
        tab — not here.
      </p>

      <Button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="bg-violet-600 hover:bg-violet-500"
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save page theme
      </Button>
    </div>
  );
}
