"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ARENA_HIGHLIGHT_LIMIT,
  ARENA_STEP_LIMIT,
  CONTENT_LIMITS,
} from "@/lib/admin/game-content-fields";
import { HERO_FEATURE_ICONS } from "@/lib/services/games/hero-features";
import { useTerms } from "@/contexts/TerminologyContext";
import type { ProviderTitleRow } from "./provider-types";
import GameArtworkField from "./GameArtworkField";

/**
 * Per-game How it works + Game tips editor.
 *
 * Owner (27 Sep 2026): these used to sit half on Page theme (steps) and half
 * on Assets (pictures) / Page content (highlights), so Volt Stack and other
 * titles looked incomplete beside Circuit. One tab owns image + title/detail
 * + icon for both panels on every game.
 */

interface Props {
  title: ProviderTitleRow;
  onSaved: (patch: Partial<ProviderTitleRow>) => void;
  contentEndpoint?: string;
  artworkEndpoint?: string;
}

interface StepDraft {
  title: string;
  detail: string;
  icon: string;
}

interface TipDraft {
  title: string;
  detail: string;
  icon: string;
}

function hydrate(title: ProviderTitleRow) {
  return {
    howToPlayImageUrl: title.howToPlayImageUrl ?? "",
    highlightsImageUrl: title.highlightsImageUrl ?? "",
    steps: (title.howItWorksSteps ?? []).map((s) => ({
      title: s.title,
      detail: s.detail,
      icon: s.icon ?? "",
    })),
    tips: (title.highlights ?? []).map((h) => ({
      title: h.title,
      detail: h.detail,
      icon: h.icon ?? "",
    })),
  };
}

export default function GameGuidesEditor({
  title,
  onSaved,
  contentEndpoint,
  artworkEndpoint,
}: Props) {
  const terms = useTerms();
  const initial = hydrate(title);
  const [howToPlayImageUrl, setHowToPlayImageUrl] = useState(
    initial.howToPlayImageUrl,
  );
  const [highlightsImageUrl, setHighlightsImageUrl] = useState(
    initial.highlightsImageUrl,
  );
  const [steps, setSteps] = useState<StepDraft[]>(initial.steps);
  const [tips, setTips] = useState<TipDraft[]>(initial.tips);
  const [saving, setSaving] = useState(false);

  // Reason: switching titles must rehydrate — same bleed class as Page theme
  // (21 Sep 2026: theme state from game A saved onto game B).
  useEffect(() => {
    const next = hydrate(title);
    setHowToPlayImageUrl(next.howToPlayImageUrl);
    setHighlightsImageUrl(next.highlightsImageUrl);
    setSteps(next.steps);
    setTips(next.tips);
  }, [title]);

  async function save() {
    const incompleteStep = steps.findIndex(
      (s) => !s.title.trim() || !s.detail.trim(),
    );
    if (incompleteStep >= 0) {
      toast.error(
        `How it works step ${incompleteStep + 1} needs both a title and a detail.`,
      );
      return;
    }
    const incompleteTip = tips.findIndex(
      (t) => !t.title.trim() || !t.detail.trim(),
    );
    if (incompleteTip >= 0) {
      toast.error(
        `Game tip ${incompleteTip + 1} needs both a title and a detail.`,
      );
      return;
    }

    setSaving(true);
    try {
      const content = {
        howToPlayImageUrl,
        highlightsImageUrl,
        howItWorksSteps: steps.map((s) => ({
          title: s.title.trim(),
          detail: s.detail.trim(),
          ...(s.icon ? { icon: s.icon } : {}),
        })),
        highlights: tips.map((t) => ({
          title: t.title.trim(),
          detail: t.detail.trim(),
          ...(t.icon ? { icon: t.icon } : {}),
        })),
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
        toast.error(
          data.error ?? "Something went wrong. Please contact support.",
        );
        return;
      }
      toast.success("How it works & tips saved");
      onSaved({
        howToPlayImageUrl: content.howToPlayImageUrl || undefined,
        highlightsImageUrl: content.highlightsImageUrl || undefined,
        howItWorksSteps: content.howItWorksSteps,
        highlights: content.highlights,
      });
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/55">
        The bottom of the {terms.player} game page and the arena strip. Every
        title gets its own copy — image, steps or tips, and an optional icon per
        line.
      </p>

      <Card className="space-y-4 border-gray-700 bg-gray-800/50 p-5 shadow-none">
        <div>
          <h3 className="text-sm font-semibold text-white">How it works</h3>
          <p className="mt-1 text-xs text-white/50">
            Numbered steps on the game page. The first {ARENA_STEP_LIMIT} also
            feed the arena strip when How to play text is empty. Leave empty to
            fall back to How to play line breaks where that path exists.
          </p>
        </div>

        <GameArtworkField
          providerKey={title.providerKey}
          gameCode={title.gameCode}
          slot="how-to-play"
          label="How it works picture"
          hint={`Shown beside the steps. A diagram of the ${terms.game}, not a logo.`}
          value={howToPlayImageUrl}
          onChange={setHowToPlayImageUrl}
          uploadEndpoint={artworkEndpoint}
        />

        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-white/60">Steps</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-gray-600"
            disabled={steps.length >= CONTENT_LIMITS.howItWorksSteps}
            onClick={() =>
              setSteps((prev) => [
                ...prev,
                { title: "", detail: "", icon: HERO_FEATURE_ICONS[0]!.slug },
              ])
            }
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add step
          </Button>
        </div>

        {steps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/40">
            No steps yet. Add one for each beat of the game (move, clear, score).
          </p>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-gray-700 p-3"
              >
                <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                  <IconSelect
                    value={step.icon}
                    onChange={(icon) =>
                      setSteps((prev) =>
                        prev.map((s, i) =>
                          i === index ? { ...s, icon } : s,
                        ),
                      )
                    }
                  />
                  <Input
                    value={step.title}
                    placeholder="Title"
                    maxLength={CONTENT_LIMITS.howItWorksTitle}
                    className="border-gray-700 bg-gray-900 text-white"
                    onChange={(e) =>
                      setSteps((prev) =>
                        prev.map((s, i) =>
                          i === index
                            ? { ...s, title: e.target.value }
                            : s,
                        ),
                      )
                    }
                  />
                </div>
                <Textarea
                  value={step.detail}
                  placeholder="Detail"
                  maxLength={CONTENT_LIMITS.howItWorksDetail}
                  className="min-h-[60px] border-gray-700 bg-gray-900 text-white"
                  onChange={(e) =>
                    setSteps((prev) =>
                      prev.map((s, i) =>
                        i === index ? { ...s, detail: e.target.value } : s,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-self-start text-red-300"
                  onClick={() =>
                    setSteps((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4 border-gray-700 bg-gray-800/50 p-5 shadow-none">
        <div>
          <h3 className="text-sm font-semibold text-white">Game tips</h3>
          <p className="mt-1 text-xs text-white/50">
            Tip cards on the game page and the arena. The first{" "}
            {ARENA_HIGHLIGHT_LIMIT} are shown on the contest strip — write each
            title so it stands alone. Up to {CONTENT_LIMITS.highlights} can be
            stored.
          </p>
        </div>

        <GameArtworkField
          providerKey={title.providerKey}
          gameCode={title.gameCode}
          slot="highlight"
          label={`${terms.game} tips picture`}
          hint="Landscape beside the tips. A badge or slogan graphic."
          value={highlightsImageUrl}
          onChange={setHighlightsImageUrl}
          uploadEndpoint={artworkEndpoint}
        />

        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-white/60">Tips</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-gray-600"
            disabled={tips.length >= CONTENT_LIMITS.highlights}
            onClick={() =>
              setTips((prev) => [
                ...prev,
                { title: "", detail: "", icon: HERO_FEATURE_ICONS[0]!.slug },
              ])
            }
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add tip
          </Button>
        </div>

        {tips.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/40">
            No tips. The tips panel stays hidden until you add at least one.
          </p>
        ) : (
          <div className="space-y-3">
            {tips.map((tip, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-gray-700 p-3"
              >
                <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                  <IconSelect
                    value={tip.icon}
                    onChange={(icon) =>
                      setTips((prev) =>
                        prev.map((t, i) =>
                          i === index ? { ...t, icon } : t,
                        ),
                      )
                    }
                  />
                  <Input
                    value={tip.title}
                    placeholder="Title"
                    maxLength={CONTENT_LIMITS.highlightTitle}
                    className="border-gray-700 bg-gray-900 text-white"
                    onChange={(e) =>
                      setTips((prev) =>
                        prev.map((t, i) =>
                          i === index
                            ? { ...t, title: e.target.value }
                            : t,
                        ),
                      )
                    }
                  />
                </div>
                <Input
                  value={tip.detail}
                  placeholder="Short supporting line"
                  maxLength={CONTENT_LIMITS.highlightDetail}
                  className="border-gray-700 bg-gray-900 text-white"
                  onChange={(e) =>
                    setTips((prev) =>
                      prev.map((t, i) =>
                        i === index ? { ...t, detail: e.target.value } : t,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-self-start text-red-300"
                  onClick={() =>
                    setTips((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="bg-violet-600 hover:bg-violet-500"
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save how it works & tips
      </Button>
    </div>
  );
}

function IconSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  return (
    <Select
      value={value || HERO_FEATURE_ICONS[0]!.slug}
      onValueChange={onChange}
    >
      <SelectTrigger className="border-gray-700 bg-gray-900 text-white">
        <SelectValue placeholder="Icon" />
      </SelectTrigger>
      <SelectContent>
        {HERO_FEATURE_ICONS.map((option) => (
          <SelectItem key={option.slug} value={option.slug}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
