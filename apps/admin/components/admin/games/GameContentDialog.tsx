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
import {
  ARENA_HIGHLIGHT_LIMIT,
  ARENA_STEP_LIMIT,
  CONTENT_LIMITS,
} from "@/lib/admin/game-content-fields";
import {
  HERO_FEATURE_ICONS,
  HERO_FEATURE_LIMIT,
} from "@/lib/services/games/hero-features";
import {
  GAME_CATEGORIES,
  normaliseCategorySlug,
  resolveGameCategory,
} from "@/lib/services/games/game-categories";
import type { ProviderTitleRow } from "./provider-types";
import GameArtworkField from "./GameArtworkField";
import GameContentAiPanel from "./GameContentAiPanel";
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
  rulesSummary: string;
  howToPlay: string;
  category: string;
  thumbnailUrl: string;
  bannerUrl: string;
  howToPlayImageUrl: string;
  highlightsImageUrl: string;
  highlights: { title: string; detail: string }[];
  heroFeatures: { icon: string; label: string }[];
}

function draftFrom(title: ProviderTitleRow): Draft {
  // An absent value becomes an empty box, and saving an empty box CLEARS the field. That is
  // safe here and unsafe for a secret: the operator can see what is stored, so a blank is a
  // decision. The credentials dialog inverts this for exactly that reason.
  return {
    displayName: title.displayName ?? "",
    tagline: title.tagline ?? "",
    description: title.description ?? "",
    rulesSummary: title.rulesSummary ?? "",
    howToPlay: title.howToPlay ?? "",
    category: title.category ?? "",
    thumbnailUrl: title.thumbnailUrl ?? "",
    bannerUrl: title.bannerUrl ?? "",
    howToPlayImageUrl: title.howToPlayImageUrl ?? "",
    highlightsImageUrl: title.highlightsImageUrl ?? "",
    highlights: title.highlights ? title.highlights.map((row) => ({ ...row })) : [],
    heroFeatures: title.heroFeatures ? title.heroFeatures.map((row) => ({ ...row })) : [],
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

  const setFeature = (at: number, key: "icon" | "label", value: string) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            heroFeatures: current.heroFeatures.map((row, index) =>
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

    // Same reason, one field along. An empty label on the banner is a floating glyph with no
    // words under it, in a fixed-height column beside three that have them.
    const blank = draft.heroFeatures.findIndex((row) => row.label.trim() === "");
    if (blank >= 0) {
      toast.error(`Banner feature ${blank + 1} needs a label.`);
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
      // Reason: every field the draft carries, and the two new ones are why this is worth a
      // comment. Omitting a saved field here leaves the parent row holding the OLD value, so
      // reopening the dialog shows the text the operator just replaced - and saving again
      // writes it back over the server's copy. A silent revert of an edit that reported
      // success, which is this codebase's recurring failure shape.
      onSaved({
        displayName: draft.displayName,
        tagline: draft.tagline,
        description: draft.description,
        rulesSummary: draft.rulesSummary,
        howToPlay: draft.howToPlay,
        category: draft.category,
        thumbnailUrl: draft.thumbnailUrl,
        bannerUrl: draft.bannerUrl,
        howToPlayImageUrl: draft.howToPlayImageUrl,
        highlightsImageUrl: draft.highlightsImageUrl,
        highlights: draft.highlights,
        heroFeatures: draft.heroFeatures,
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
          {/*
            The assistant PROPOSES into this form and never posts anything itself, so its
            suggestions are subject to the same Save press, the same validation and the same
            audit line as anything typed by hand. It is placed above the fields it can write
            and above the two it cannot, so the sentence explaining the difference is read
            before an operator wonders why the two big boxes were skipped.
          */}
          <GameContentAiPanel
            gameKey={title.gameKey}
            onApply={(patch) =>
              setDraft((current) => (current ? { ...current, ...patch } : current))
            }
          />

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

          {/*
            Both of these are the PROVIDER's account of their own game, seeded on the first
            sync and editable here so an operator can fix grammar, tone or language. Neither
            is generated: `01` s3 says the rules summary is the first text support quotes
            back when a player disputes a prize, so invented wording here is invented
            wording in a money argument. The AI panel on this screen is deliberately scoped
            away from both (owner decision, 10 September 2026).
          */}
          <Field
            label="Rules summary"
            hint="How the score is produced and how ties break. Support quotes this back when a player disputes a prize, so it must match what the game actually does."
            length={draft.rulesSummary.length}
            limit={CONTENT_LIMITS.rulesSummary}
          >
            <Textarea
              rows={4}
              value={draft.rulesSummary}
              maxLength={CONTENT_LIMITS.rulesSummary}
              onChange={(event) => set("rulesSummary", event.target.value)}
            />
          </Field>

          <Field
            label="How to play"
            /*
              THE HINT NAMES THE FORMAT BECAUSE THE FORMAT IS THE ONLY INPUT TO IT. The contest
              screen numbers each LINE as a step and shows the first three; written as one
              paragraph it renders as one line, which is correct and is not what the reference
              shows. Nothing else can tell an operator that - the field accepts both and both
              save - so the alternative to this sentence is a screen that looks wrong for a
              reason nobody can find, which is how this panel came to be rebuilt.
            */
            hint={`The controls and constraints in plain language. One line per step: the contest screen numbers them and shows the first ${ARENA_STEP_LIMIT}. A player asking how to play and a player asking why they lost are asking two different questions.`}
            length={draft.howToPlay.length}
            limit={CONTENT_LIMITS.howToPlay}
          >
            <Textarea
              rows={4}
              value={draft.howToPlay}
              maxLength={CONTENT_LIMITS.howToPlay}
              onChange={(event) => set("howToPlay", event.target.value)}
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

          {/*
            THE ARENA'S TWO ILLUSTRATIONS, owner's instruction of 11 September 2026. Kept in
            their own row under their own heading rather than added to the logo/banner pair
            above, because those two identify the TITLE everywhere it appears and these two
            decorate two named panels on one screen - an operator choosing artwork needs to
            know which is which, and four unlabelled boxes in a row does not tell them.

            BOTH ARE OPTIONAL AND SAYING SO IS THE POINT OF THE HINTS. Leaving one blank is
            not an unfinished job: the panel draws a recreated emblem instead, which is a
            deliberate look rather than a gap, and an operator who believes otherwise
            uploads a stock image to fill a hole that was never there.
          */}
          <div className="space-y-3">
            <div>
              <Label>Arena illustrations</Label>
              <p className="text-xs text-white/50">
                The pictures beside the two text panels under the board. Optional - each one
                falls back to a drawn emblem.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <GameArtworkField
                providerKey={providerKey}
                gameCode={title.gameCode}
                slot="how-to-play"
                label="How it works picture"
                /*
                  THE HINT NAMES THE PANEL THE PLAYER SEES, and it was renamed with the band.
                  These two slots are the only place an operator learns which picture lands
                  where, and the reason that matters is that the two are easy to swap: the
                  first build of the band had the emblem in the rules card and the diagram
                  beside the tips, because the labels said "rules" and "highlights" while the
                  screen says "How it works" and "Game tips".
                */
                hint="Small square, beside the numbered steps. A diagram of the game, not a logo."
                value={draft.howToPlayImageUrl}
                onChange={(url) => set("howToPlayImageUrl", url)}
              />
              <GameArtworkField
                providerKey={providerKey}
                gameCode={title.gameCode}
                slot="highlight"
                label="Game tips picture"
                hint="Small landscape, beside the ticked tips. A badge or a slogan graphic."
                value={draft.highlightsImageUrl}
                onChange={(url) => set("highlightsImageUrl", url)}
              />
            </div>
          </div>

          {/*
            The hero banner's strip (owner, 11 September 2026).

            THE EMPTY STATE IS THE INTERESTING ONE and it is the reason this block carries
            more prose than the fields above it. Leaving the list empty is not "show nothing"
            - the banner works four features out from the title's own settings - so an
            operator who adds one row has silently replaced all four, and an operator who
            deletes their rows has restored them. Neither is guessable from a list of inputs,
            which is why both sentences are on the screen rather than in a comment.
          */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Banner features</Label>
                <p className="text-xs text-white/50">
                  The {HERO_FEATURE_LIMIT} icon-and-label items across the middle of the
                  game&apos;s hero banner. Leave this empty and the banner works them out from
                  the title&apos;s own settings - the round length, the contest&apos;s player
                  range and how it is scored. Add even one and yours replace all of them.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draft.heroFeatures.length >= CONTENT_LIMITS.heroFeatures}
                onClick={() =>
                  set("heroFeatures", [
                    ...draft.heroFeatures,
                    { icon: HERO_FEATURE_ICONS[0].slug as string, label: "" },
                  ])
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            {draft.heroFeatures.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/40">
                None written. The banner shows the {HERO_FEATURE_LIMIT} it works out itself.
              </p>
            ) : (
              draft.heroFeatures.map((row, at) => (
                <div
                  key={at}
                  className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_2fr]">
                    {/*
                      THE SHARED `Select`, never a native `<select>`. This surface's fields are
                      `bg-white/5 text-white`, and a browser paints a native drop-down list
                      itself - taking the background from the element and letting the options
                      inherit the colour - so a translucent white composites over the
                      browser's light list surface and every option is white on white. That is
                      R60, reported on this very dialog's genre picker.
                    */}
                    <Select
                      value={row.icon}
                      onValueChange={(value) => setFeature(at, "icon", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HERO_FEATURE_ICONS.map((option) => (
                          <SelectItem key={option.slug} value={option.slug}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={row.label}
                      maxLength={CONTENT_LIMITS.heroFeatureLabel}
                      placeholder="Fast rounds"
                      onChange={(event) => setFeature(at, "label", event.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-white/40 hover:text-red-300"
                    onClick={() =>
                      set(
                        "heroFeatures",
                        draft.heroFeatures.filter((_, index) => index !== at),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Highlights</Label>
                {/*
                  IT SAYS WHICH ONES GET DRAWN, because the two numbers disagree and only the
                  operator can act on it. The player's card is a fixed-height strip with room
                  for four lines, so a fifth and sixth are stored and never shown - and the
                  only place that is visible is here, beside the button that offers them.

                  The TITLE alone is what the card draws, with the detail on its tooltip, so
                  the title has to stand on its own. That is worth saying next to a field
                  labelled "detail" that an operator would otherwise write the substance into.
                */}
                <p className="text-xs text-white/50">
                  Ticked lines on the contest screen. The first{" "}
                  {ARENA_HIGHLIGHT_LIMIT} titles are shown, so write each title so it
                  reads on its own; the detail appears on hover. Up to{" "}
                  {CONTENT_LIMITS.highlights} can be stored; none is fine.
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
