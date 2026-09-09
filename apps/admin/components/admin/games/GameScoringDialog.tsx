"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trophy, TriangleAlert } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  describeScoreEligibility,
} from "@/lib/admin/score-eligibility-copy";
import { SCORE_UNIT_MAX_LENGTH } from "@/lib/services/game-providers/game-scoring-rules.service";
import type { ProviderTitleRow } from "./provider-types";

/**
 * Which scores win a prize on one catalogue title. Task document 14.
 *
 * IT IS NOT PART OF THE CONTENT EDITOR, and that separation is the point rather than a
 * layout preference - the same argument as the Play style control beside it. The content
 * dialog writes a tagline, a description and artwork: copy an operator can rewrite freely and
 * get wrong harmlessly. This decides WHO IS PAID out of a pot people have bought into, so it
 * has its own route, its own section guard and its own audit line, and all three fields are
 * in `NEVER_EDITABLE_CONTENT_FIELDS`.
 *
 * IT NAMES NO GAME. Every word comes from the catalogue row and from
 * `describeScoreEligibility`, so a title we have never seen explains its own rules. A
 * `switch` on game code here is what would make the "no developer needed for a new title"
 * claim quietly false, and a test forbids one.
 *
 * THE DIRECTION IS SHOWN AND NOT EDITABLE, which is the detail most likely to be "fixed" into
 * a control. `scoreDirection` is in `providerOwnedFields`, so an edit here would save, toast,
 * and be reverted by the next catalogue sync with nothing in a log. It is rendered because the
 * bar below is meaningless without it: 60,000 is a floor on a points game and a ceiling on a
 * stopwatch, and an operator who cannot see which will set it the wrong way round.
 *
 * THE PREVIEW IS THE FEATURE. Two switches and a number cannot be understood in the abstract,
 * and the failure mode is silent - a bar set the wrong way round refuses everybody who did
 * well and there is no error anywhere. So the consequences are spelled out in sentences that
 * change as the form does, from a module pinned behaviourally against the real gate.
 */

interface Props {
  providerKey: string;
  title: ProviderTitleRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (rules: Partial<ProviderTitleRow>) => void;
}

interface Draft {
  zeroIsValidResult: boolean;
  /** Held as TEXT, not a number - see the note in `handleSave`. */
  minimumEligibleScore: string;
  scoreUnit: string;
}

function draftFrom(title: ProviderTitleRow): Draft {
  return {
    zeroIsValidResult: title.zeroIsValidResult === true,
    // Reason: `!== undefined && !== null`, never `?? ""` on the number directly. A stored `0`
    // is a real instruction - on a higher-is-better game it admits a zero score - and
    // `title.minimumEligibleScore ?? ""` would render it as an empty box, so opening the
    // dialog and pressing Save would silently CLEAR a bar the operator had set to zero.
    minimumEligibleScore:
      title.minimumEligibleScore === undefined || title.minimumEligibleScore === null
        ? ""
        : String(title.minimumEligibleScore),
    scoreUnit: title.scoreUnit ?? "",
  };
}

export default function GameScoringDialog({
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

  const direction =
    title.scoreDirection === "lower_is_better" ? "lower_is_better" : "higher_is_better";

  const barText = draft.minimumEligibleScore.trim();
  const barNumber = barText === "" ? undefined : Number(barText);
  const barIsBroken = barText !== "" && !Number.isFinite(barNumber);

  const preview = describeScoreEligibility({
    zeroIsValidResult: draft.zeroIsValidResult,
    minimumEligibleScore: barIsBroken ? undefined : barNumber,
    scoreDirection: direction,
    scoreUnit: draft.scoreUnit.trim() || undefined,
  });

  const handleSave = async () => {
    // Reason the draft holds text and the number is parsed HERE: an `<input type="number">`
    // reports a half-typed "6e" as an empty string, so a numeric draft cannot tell "cleared"
    // from "mid-typing" and a blur at the wrong moment clears the bar. Parsing at the edge
    // also means the refusal below can name the problem instead of the server rejecting a
    // `NaN` - which it does guard, because a `NaN` bar makes every comparison in
    // `providerHasResult` false and routes the whole pot to the unclaimed pool.
    if (barIsBroken) {
      toast.error("A minimum score must be a number, or empty for no minimum.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/games/providers/${providerKey}/games/scoring`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameCode: title.gameCode,
            rules: {
              zeroIsValidResult: draft.zeroIsValidResult,
              // `null` is the CLEAR instruction and an absent key is an error, so this is
              // written explicitly rather than omitted - the route refuses a body that leaves
              // it out, precisely so a malformed request cannot clear a bar by accident.
              minimumEligibleScore: barNumber === undefined ? null : barNumber,
              scoreUnit: draft.scoreUnit.trim() === "" ? null : draft.scoreUnit.trim(),
            },
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      onSaved({
        zeroIsValidResult: data.zeroIsValidResult,
        minimumEligibleScore: data.minimumEligibleScore ?? undefined,
        scoreUnit: data.scoreUnit ?? undefined,
      });
      toast.success(`Prize eligibility saved for ${title.displayName}.`);
      onOpenChange(false);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            Prize eligibility — {title.displayName}
          </DialogTitle>
          <DialogDescription>
            Which scores are worth a prize on this game. A player refused here still appears
            on the leaderboard; their share is spread across the players who did score.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">Which way is better</Label>
                <p className="text-xs text-white/50">
                  The provider declares this and a catalogue sync rewrites it, so it cannot be
                  changed here. It decides which way the minimum below works.
                </p>
              </div>
              <Badge
                variant="outline"
                className="shrink-0 border-sky-500/40 bg-sky-500/10 text-xs text-sky-300"
              >
                {direction === "lower_is_better" ? "Lower is better" : "Higher is better"}
              </Badge>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-3">
            <div>
              <Label htmlFor="zero-valid" className="text-sm">
                A score of zero counts as a result
              </Label>
              <p className="mt-1 text-xs text-white/50">
                Off for every game we run today: a zero means the player did not manage
                anything, so it wins nothing. Turn it on only for a game where zero is a real
                achievement — no mistakes, no penalties.
              </p>
            </div>
            <Switch
              id="zero-valid"
              checked={draft.zeroIsValidResult}
              disabled={saving}
              onCheckedChange={(checked) =>
                setDraft((current) =>
                  current ? { ...current, zeroIsValidResult: checked } : current,
                )
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="min-score" className="text-sm">
                Minimum score to be paid
              </Label>
              <Input
                id="min-score"
                inputMode="decimal"
                placeholder="Leave empty for no minimum"
                value={draft.minimumEligibleScore}
                disabled={saving}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? { ...current, minimumEligibleScore: event.target.value }
                      : current,
                  )
                }
              />
              <p className="text-xs text-white/50">
                {direction === "lower_is_better"
                  ? "Lower is better here, so this is the worst score still worth a prize."
                  : "The lowest score still worth a prize."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="score-unit" className="text-sm">
                Unit
              </Label>
              <Input
                id="score-unit"
                placeholder="points"
                maxLength={SCORE_UNIT_MAX_LENGTH}
                value={draft.scoreUnit}
                disabled={saving}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, scoreUnit: event.target.value } : current,
                  )
                }
              />
              <p className="text-xs text-white/50">Shown beside scores. Never ranked on.</p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
              <TriangleAlert className="h-4 w-4" />
              What this will do
            </div>
            <ul className="space-y-1 text-xs text-white/70">
              {preview.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-amber-300/60">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save eligibility
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
