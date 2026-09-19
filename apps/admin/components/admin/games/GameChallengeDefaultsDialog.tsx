"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Swords, TriangleAlert } from "lucide-react";
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
import { useTerms } from "@/contexts/TerminologyContext";
// Reason: BOTH model-free modules, and this is R58 rather than a preference. A `"use client"`
// file may not name a driver-reaching module in a value-import position, and the admin app went
// down for exactly that once. `config-schema.ts` has no imports at all; `challenge-defaults.ts`
// imports only from it and a type from `round-types`.
import { parseConfigSchema, type ConfigField } from "@/lib/services/games/config-schema";
import { resolveChallengeDefaults } from "@/lib/services/games/challenge-defaults";
import { ConfigSchemaFields } from "./ConfigSchemaFields";
import type { ProviderTitleRow } from "./provider-types";
import { DIALOG_WIDTH_MEDIUM } from "@/lib/admin/dialog-widths";

/**
 * What a player's challenge form opens pre-filled with, for one catalogue title.
 *
 * OWNER REQUEST, 13 SEPTEMBER 2026. A player creating a 1v1 was being asked a game's own
 * questions with no answers in them - how long it runs, a board size, a difficulty - and unlike
 * an operator drafting a contest they have no way to tell a sensible answer from a bad one.
 *
 * IT IS NOT PART OF THE CONTENT EDITOR, the same separation as Play style and Prize eligibility
 * beside it, and for a sharper reason than either: the join rule here is the only way to
 * reinstate the late-start refusal R73 removed, so accepting it in the content dialog would let
 * a paid 1v1's play rule change as a side effect of fixing a typo in a tagline, with the audit
 * trail recording a content edit. `challengeDefaults` is in `NEVER_EDITABLE_CONTENT_FIELDS`.
 *
 * IT NAMES NO GAME. Every question below the two platform controls comes from the provider's own
 * `configSchema`, rendered by the same `ConfigSchemaFields` the contest wizard uses, so a title
 * we have never seen presents its own settings. A `switch` on game code here is the one way to
 * make "a new title needs no code" quietly false, and a test forbids one.
 *
 * IT PARSES THE SCHEMA THROUGH `parseConfigSchema`, NOT BY READING THE RAW OBJECT. That parser
 * fails closed on a keyword it does not support, so a schema this screen cannot fully validate
 * renders no fields at all rather than a form missing half the real constraints - which would
 * collect answers the provider then rejects at play time.
 *
 * THE PREVIEW IS THE FEATURE, as it is on the eligibility dialog. Reserving a whole round is the
 * control most likely to be set with the wrong expectation, and its failure is silent: nothing
 * errors, both players simply find they have paid for a challenge neither can start.
 */

interface Props {
  providerKey: string;
  title: ProviderTitleRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (defaults: Pick<ProviderTitleRow, "challengeDefaults">) => void;
}

interface Bounds {
  minMinutes: number;
  maxMinutes: number;
  fallbackMinutes: number;
}

interface Draft {
  /** Held as TEXT for the reason `GameScoringDialog` records: a number input cannot tell
   *  "cleared" from "mid-typing", so a blur at the wrong moment would clear the length. */
  durationMinutes: string;
  reserveFullRound: boolean;
  settings: Record<string, unknown>;
}

export default function GameChallengeDefaultsDialog({
  providerKey,
  title,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const terms = useTerms();

  const parsed = title ? parseConfigSchema(title.configSchema) : undefined;
  const fields: ConfigField[] = parsed?.ok ? parsed.fields : [];

  // Reason: the bounds are FETCHED rather than written into this component's `min`/`max`. They
  // are administered on the Challenge settings screen, so a number typed here is a second copy
  // of a rule the server enforces, and the two drift in the quiet direction - the control offers
  // a length the save then refuses, naming a range this screen never showed.
  useEffect(() => {
    if (!open || !title) return;
    let live = true;

    (async () => {
      try {
        const response = await fetch(
          `/api/games/providers/${providerKey}/games/challenge-defaults`,
        );
        const data = await response.json();
        if (!live || !response.ok) return;
        setBounds(data.bounds as Bounds);
      } catch {
        // Reason: silent. The dialog cannot open its length control without the bounds and says
        // so below; a toast on a background read the operator did not ask for is noise.
      }
    })();

    return () => {
      live = false;
    };
  }, [open, title, providerKey]);

  // The draft is seeded through the SAME resolver a player's dialog will use, never from the
  // stored object directly. An operator must see what a player would see - including a stored
  // setting the schema has since stopped accepting, which the resolver drops back to the
  // declared default rather than leaving as a value that cannot be saved again.
  useEffect(() => {
    if (!open || !title || !bounds) return;
    const effective = resolveChallengeDefaults({
      fields,
      stored: title.challengeDefaults,
      bounds,
      fallbackMinutes: bounds.fallbackMinutes,
    });
    setDraft({
      durationMinutes: String(effective.durationMinutes),
      reserveFullRound: effective.roundStartPolicy === "reserve_full_round",
      settings: effective.settings,
    });
    // Reason: `fields` is derived from `title` and is a fresh array on every render, so it is
    // deliberately not a dependency - including it re-seeds the draft on each keystroke and
    // discards what the operator is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, bounds]);

  const changeSetting = useCallback((name: string, value: unknown) => {
    setDraft((current) =>
      current ? { ...current, settings: { ...current.settings, [name]: value } } : current,
    );
  }, []);

  if (!title) return null;

  const save = async (clearing: boolean) => {
    if (!clearing && !draft) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/games/providers/${providerKey}/games/challenge-defaults`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameCode: title.gameCode,
            // `null` is the CLEAR instruction and the key is always present: the route refuses a
            // body that omits it, precisely so a malformed request cannot clear an operator's
            // decision by accident.
            challengeDefaults: clearing
              ? null
              : {
                  durationMinutes: draft!.durationMinutes.trim(),
                  roundStartPolicy: draft!.reserveFullRound
                    ? "reserve_full_round"
                    : "until_window_closes",
                  settings: draft!.settings,
                },
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      onSaved({ challengeDefaults: data.stored ?? undefined });
      toast.success(
        clearing
          ? `${terms.challenge} defaults cleared for ${title.displayName}.`
          : `${terms.challenge} defaults saved for ${title.displayName}.`,
      );
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
            <Swords className="h-5 w-5 text-fuchsia-400" />
            {terms.challenge} defaults — {title.displayName}
          </DialogTitle>
          <DialogDescription>
            What a {terms.player}&apos;s {terms.challenge} form opens pre-filled with. They can
            still change any of it; this is the answer they get if they change nothing.
          </DialogDescription>
        </DialogHeader>

        {parsed && !parsed.ok ? (
          // Refused with the reason rather than a form with the settings quietly missing: a
          // schema we cannot validate means we cannot tell a valid answer from an invalid one,
          // so saving a length alone would leave an operator believing they had chosen a board
          // size they had not.
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This {terms.game}&apos;s settings are not supported, so nothing can be pre-filled
                for it:{" "}
                {parsed.error}
              </span>
            </div>
          </div>
        ) : !bounds || !draft ? (
          <div className="flex items-center justify-center py-10 text-white/50">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading limits…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="challenge-minutes" className="text-sm">
                How long the {terms.challenge} runs
              </Label>
              <Input
                id="challenge-minutes"
                inputMode="numeric"
                value={draft.durationMinutes}
                disabled={saving}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, durationMinutes: event.target.value } : current,
                  )
                }
              />
              <p className="text-xs text-white/50">
                Minutes, between {bounds.minMinutes} and {bounds.maxMinutes}. Both{" "}
                {terms.players} have this long from the moment the {terms.challenge} is
                accepted.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-3">
              <div>
                <Label htmlFor="reserve-round" className="text-sm">
                  Reserve a whole {terms.round} before the end
                </Label>
                <p className="mt-1 text-xs text-white/50">
                  Off for every {terms.game} we run today. Off, a {terms.player} who starts late
                  gets a shorter {terms.round} and is told how much time they have. On, they are
                  refused once a full {terms.round} no longer fits — turn it on only for a{" "}
                  {terms.game} where a cut-short run is worth nothing.
                </p>
              </div>
              <Switch
                id="reserve-round"
                checked={draft.reserveFullRound}
                disabled={saving}
                onCheckedChange={(checked) =>
                  setDraft((current) =>
                    current ? { ...current, reserveFullRound: checked } : current,
                  )
                }
              />
            </div>

            <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div>
                <Label className="text-sm">This {terms.game}&apos;s own settings</Label>
                <p className="mt-1 text-xs text-white/50">
                  Declared by the provider. A {terms.player} sees these same questions, opened
                  with whatever is chosen here.
                </p>
              </div>
              <ConfigSchemaFields
                fields={fields}
                values={draft.settings}
                onChange={changeSetting}
                disabled={saving}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {/* Clearing is offered only when there is something stored, for the reason the provider
              cards record: a control that cannot do anything teaches an operator nothing. */}
          {title.challengeDefaults ? (
            <Button variant="ghost" onClick={() => save(true)} disabled={saving}>
              Clear defaults
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={() => save(false)}
              disabled={saving || !draft || (parsed !== undefined && !parsed.ok)}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save defaults
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
