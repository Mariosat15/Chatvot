"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon, Plus, Trash2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { CONTENT_LIMITS } from "@/lib/admin/game-content-fields";
import {
  GAME_CATEGORIES,
  normaliseCategorySlug,
  resolveGameCategory,
} from "@/lib/services/games/game-categories";
import type { ProviderTitleRow } from "./provider-types";
import GameArtworkField from "./GameArtworkField";
import { DIALOG_WIDTH_MEDIUM } from "@/lib/admin/dialog-widths";

/**
 * The operator's copy and artwork for one catalogue title.
 *
 * This is the only screen that writes presentation content, and it deliberately does NOT
 * carry the Live on ChartVolt switch even though that is also operator-owned. Mixing them
 * would mean a game could go live as a side effect of fixing a typo, and the audit line
 * would record a content edit. The switch stays on the catalogue row where it is the only
 * thing in its column.
 *
 * The limits come from `game-content-fields.ts` rather than being typed in here, because a
 * counter that says 120 while the server refuses at 100 is a form that reports success and
 * then fails with a 400 the operator reads as a permissions problem.
 */

interface Props {
  providerKey: string;
  title: ProviderTitleRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (content: Partial<ProviderTitleRow>) => void;
}

interface Draft {
  displayName: string;
  tagline: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  bannerUrl: string;
  highlights: { title: string; detail: string }[];
}

function draftFrom(title: ProviderTitleRow): Draft {
  // An absent value becomes an empty box, and saving an empty box CLEARS the field. That is
  // safe here and unsafe for a secret: the operator can see what is stored, so a blank is a
  // decision. The credentials dialog inverts this for exactly that reason.
  return {
    displayName: title.displayName ?? "",
    tagline: title.tagline ?? "",
    description: title.description ?? "",
    category: title.category ?? "",
    thumbnailUrl: title.thumbnailUrl ?? "",
    bannerUrl: title.bannerUrl ?? "",
    highlights: title.highlights ? title.highlights.map((row) => ({ ...row })) : [],
  };
}

export default function GameContentDialog({
  providerKey,
  title,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && title) setDraft(draftFrom(title));
  }, [open, title]);

  if (!title || !draft) return null;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const setHighlight = (at: number, key: "title" | "detail", value: string) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            highlights: current.highlights.map((row, index) =>
              index === at ? { ...row, [key]: value } : row,
            ),
          }
        : current,
    );

  const handleSave = async () => {
    // Reason: a half-filled card renders as a bug on the player's screen rather than as an
    // operator leaving something out, so it is caught here with a message naming the row
    // instead of arriving as the server's generic refusal.
    const incomplete = draft.highlights.findIndex(
      (row) => row.title.trim() === "" || row.detail.trim() === "",
    );
    if (incomplete >= 0) {
      toast.error(`Highlight ${incomplete + 1} needs both a title and a detail.`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/games/providers/${providerKey}/games/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameCode: title.gameCode, content: draft }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      toast.success(`Content saved for ${draft.displayName}.`);
      onSaved({
        displayName: draft.displayName,
        tagline: draft.tagline,
        description: draft.description,
        category: draft.category,
        thumbnailUrl: draft.thumbnailUrl,
        bannerUrl: draft.bannerUrl,
        highlights: draft.highlights,
      });
      onOpenChange(false);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[88vh] overflow-y-auto ${DIALOG_WIDTH_MEDIUM}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            Game page content — {title.displayName}
          </DialogTitle>
          <DialogDescription>
            What players see on this game&apos;s contest screens. The provider supplies how
            the game <em>works</em>; everything here is ours and a catalogue sync will never
            overwrite it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field
            label="Title"
            hint="The name players see. It replaces whatever the provider called it."
            length={draft.displayName.length}
            limit={CONTENT_LIMITS.displayName}
          >
            <Input
              value={draft.displayName}
              maxLength={CONTENT_LIMITS.displayName}
              onChange={(event) => set("displayName", event.target.value)}
            />
          </Field>

          <Field
            label="Tagline"
            hint="One short line under the title. Leave it empty and no line is shown."
            length={draft.tagline.length}
            limit={CONTENT_LIMITS.tagline}
          >
            <Input
              value={draft.tagline}
              maxLength={CONTENT_LIMITS.tagline}
              placeholder="Run. Jump. Survive. Win!"
              onChange={(event) => set("tagline", event.target.value)}
            />
          </Field>

          <CategoryField
            value={draft.category}
            onChange={(slug) => set("category", slug)}
          />

          <Field
            label="Description"
            hint="What the game is and why it is fun. Shown on the contest screen and, later, the game's own page."
            length={draft.description.length}
            limit={CONTENT_LIMITS.description}
          >
            <Textarea
              rows={4}
              value={draft.description}
              maxLength={CONTENT_LIMITS.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <GameArtworkField
              providerKey={providerKey}
              gameCode={title.gameCode}
              slot="logo"
              label="Logo"
              hint="Square. Shown beside the title and, later, on the dashboard tile players click."
              value={draft.thumbnailUrl}
              onChange={(url) => set("thumbnailUrl", url)}
            />
            <GameArtworkField
              providerKey={providerKey}
              gameCode={title.gameCode}
              slot="banner"
              label="Banner"
              hint="Wide. The strip behind the contest heading. Unset falls back to a generic banner."
              value={draft.bannerUrl}
              onChange={(url) => set("bannerUrl", url)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Highlights</Label>
                <p className="text-xs text-white/50">
                  The small cards along the bottom of the contest screen. Up to{" "}
                  {CONTENT_LIMITS.highlights}; none is fine.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draft.highlights.length >= CONTENT_LIMITS.highlights}
                onClick={() =>
                  set("highlights", [...draft.highlights, { title: "", detail: "" }])
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            {draft.highlights.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/40">
                No highlights. The row is left out of the player&apos;s screen entirely.
              </p>
            ) : (
              draft.highlights.map((row, at) => (
                <div
                  key={at}
                  className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_2fr]">
                    <Input
                      value={row.title}
                      maxLength={CONTENT_LIMITS.highlightTitle}
                      placeholder="Fast-Paced Fun"
                      onChange={(event) => setHighlight(at, "title", event.target.value)}
                    />
                    <Input
                      value={row.detail}
                      maxLength={CONTENT_LIMITS.highlightDetail}
                      placeholder="Short rounds. Big thrills."
                      onChange={(event) => setHighlight(at, "detail", event.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-white/40 hover:text-red-300"
                    onClick={() =>
                      set(
                        "highlights",
                        draft.highlights.filter((_, index) => index !== at),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save content
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The genre picker: the predefined vocabulary, plus a way to say something else.
 *
 * Task 9 asks for "a combination of predefined category and custom category rather than
 * hardcoding a tiny permanent list", and this is that combination. The dropdown is the
 * vocabulary; "Something else" reveals a box, and what an operator types is slugified AND
 * SHOWN BACK TO THEM before they save.
 *
 * Showing the slug is the load-bearing part rather than a nicety. The server normalises what
 * it is sent, so "Sci Fi" is stored as `sci-fi` - and a transformation the operator cannot
 * see is indistinguishable, from their seat, from the field not saving what they typed. It is
 * also the reason the server can normalise instead of refusing: nothing is being rewritten
 * behind anybody's back.
 *
 * A stored value the vocabulary does not carry - the mock catalogue's `quiz`, or anything
 * seeded by a provider before this existed - opens in the custom box with its own text
 * intact. It is NOT silently remapped to the nearest known genre and it is NOT dropped: that
 * value is already the grouping key for whatever has been filed under it.
 *
 * IT USES THE SHARED `Select`, AND A NATIVE `<select>` HERE IS A LIVE DEFECT RATHER THAN A
 * STYLE CHOICE. A browser paints the native drop-down list itself, taking the background from
 * the element's own `background-color` but letting the options inherit `color`. This screen's
 * fields are `bg-white/5 text-white`, and a translucent white composites over the browser's
 * light list surface - so every option was white on white. Only the highlighted row was
 * legible, against the operating system's selection band, which is exactly what the owner
 * reported: a tall empty list with one word in it. Nothing was missing and nothing failed to
 * render.
 *
 * // Reason: the eleven other pickers on this surface already use the primitive, which draws
 * its own list in a portal and never asks the browser for one. This was the only native
 * `<select>` left, so it was also the only one that could take a background from the theme and
 * a foreground from the theme and still end up unreadable.
 */

/**
 * Radix refuses an empty `value` on an item - it reserves `""` for "nothing is selected", and
 * a `SelectItem value=""` throws - so "no genre" travels as a sentinel and is mapped back to
 * `""` at the boundary. Stored state is unaffected: absent is still absent.
 *
 * Same shape as `GamePlayStyleControl`'s `__follow_provider__`, and the double underscores are
 * what keep both out of the slug namespace: `normaliseCategorySlug` strips every non
 * alphanumeric run, so no genre an operator can type will ever collide with one of these.
 */
const NO_GENRE = "__no_genre__";
const CUSTOM = "__custom__";

function CategoryField({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  const resolved = resolveGameCategory(value);
  const isCustom = resolved !== undefined && !resolved.isKnown;

  // Reason: which mode the control is in has to be state, not derived from `value`. Derived,
  // choosing "Something else" would set the value to "" - which resolves to `undefined`, not
  // to a custom value - so the box would close the instant it opened.
  const [mode, setMode] = useState<"list" | "custom">(isCustom ? "custom" : "list");
  const [typed, setTyped] = useState(isCustom ? value : "");

  const preview = normaliseCategorySlug(typed);

  return (
    <div className="space-y-1.5">
      <Label>Genre</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          value={mode === "custom" ? CUSTOM : value === "" ? NO_GENRE : value}
          onValueChange={(next) => {
            if (next === CUSTOM) {
              setMode("custom");
              onChange(normaliseCategorySlug(typed) ?? "");
              return;
            }
            setMode("list");
            onChange(next === NO_GENRE ? "" : next);
          }}
        >
          <SelectTrigger className="h-10 border-white/10 bg-white/5 text-sm text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_GENRE}>No genre</SelectItem>
            {GAME_CATEGORIES.map((entry) => (
              <SelectItem key={entry.slug} value={entry.slug}>
                {entry.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Something else…</SelectItem>
          </SelectContent>
        </Select>

        {mode === "custom" && (
          <Input
            value={typed}
            maxLength={CONTENT_LIMITS.category}
            placeholder="Rhythm"
            onChange={(event) => {
              setTyped(event.target.value);
              onChange(normaliseCategorySlug(event.target.value) ?? "");
            }}
          />
        )}
      </div>
      <p className="text-xs text-white/50">
        {mode === "custom" ? (
          preview ? (
            <>
              Stored as <code className="text-violet-300">{preview}</code> — one genre, however
              it is typed, so counts and filters group it together.
            </>
          ) : (
            "Type a genre. It is stored in lower case with hyphens so it can be grouped on."
          )
        ) : (
          "A badge beside the title on the player's screen. Leave it at No genre and no badge is shown."
        )}
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  length,
  limit,
  children,
}: {
  label: string;
  hint: string;
  length: number;
  limit: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-white/35">
          {length}/{limit}
        </span>
      </div>
      {children}
      <p className="flex items-start gap-1.5 text-xs text-white/50">
        <ImageIcon className="mt-0.5 hidden h-3 w-3 shrink-0" aria-hidden />
        {hint}
      </p>
    </div>
  );
}
