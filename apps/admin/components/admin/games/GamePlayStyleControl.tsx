"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canOverridePlayMode,
  PLAY_MODES,
  PLAY_MODE_COPY,
  resolvePlayMode,
  resolveSupportedPlayModes,
  type PlayMode,
} from "@/lib/services/games/play-shape";
import type { ProviderTitleRow } from "./provider-types";

/**
 * Whether everybody plays this title at once, set per title.
 *
 * IT IS NOT PART OF THE CONTENT EDITOR, and that separation is the point rather than a
 * layout preference. The content dialog writes a tagline, a description and artwork - copy an
 * operator can rewrite freely and get wrong harmlessly. This decides when entry closes and
 * how many attempts a player gets, on a contest people have paid to enter, so it has its own
 * route, its own audit line and its own refusal, exactly like the Live on ChartVolt switch
 * beside it. `playModeOverride` is in `NEVER_EDITABLE_CONTENT_FIELDS` for the same reason
 * `chartvoltEnabled` is: nobody should change how a game is played as a side effect of
 * fixing a typo.
 *
 * IT NAMES NO GAME. Every word rendered here comes from `PLAY_MODE_COPY` and from the
 * catalogue row, so a title we have never seen shows its own style with its own explanation.
 * A `switch` on game code here is what would make the "no developer needed for a new title"
 * claim quietly false, and a test forbids one.
 *
 * THE EFFECTIVE STYLE IS NOT COMPUTED HERE. `resolvePlayMode` is imported and called, never
 * restated - it holds the precedence rule (`head_to_head` beats the override, which beats the
 * declaration) and a second copy in the browser would let this control disagree with the
 * service that enforces it. The `head_to_head` case is asked through `canOverridePlayMode`
 * for the same reason: the service refuses that write, so offering the choice here would
 * produce a 400 that reads to an operator like a permissions problem.
 */

interface Props {
  providerKey: string;
  title: ProviderTitleRow;
  onChanged: (next: {
    playModeOverride?: string;
    supportedPlayModes?: string[];
  }) => void;
}

/** The sentinel for "we have taken no decision, follow the provider". */
const FOLLOW = "__follow_provider__";

export default function GamePlayStyleControl({
  providerKey,
  title,
  onChanged,
}: Props) {
  const [saving, setSaving] = useState(false);

  const effective = resolvePlayMode(title);
  const overridable = canOverridePlayMode(title);
  const copy = PLAY_MODE_COPY.get(effective);

  // Withheld WITH ITS REASON rather than greyed out. A disabled control teaches an operator
  // that the setting does not apply to them; one that says why is the feature. Same rule as
  // refusing to enable a provider with no adapter, and as the round-start control the wizard
  // withholds on a scheduled contest.
  if (!overridable) {
    return (
      <div className="space-y-1">
        <Badge
          variant="outline"
          className="border-sky-500/40 bg-sky-500/10 text-xs text-sky-300"
        >
          <Users className="mr-1 h-3 w-3" />
          {PLAY_MODE_COPY.get("scheduled")?.label}
        </Badge>
        <div className="flex items-start gap-1 text-xs text-white/40">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            This game needs an opponent, so both players are always up against each other
            live. There is nothing to choose.
          </span>
        </div>
      </div>
    );
  }

  const declared = resolvePlayMode({ family: title.family, playMode: title.playMode });

  const save = async (value: string) => {
    const playMode = value === FOLLOW ? null : (value as PlayMode);
    setSaving(true);
    try {
      const response = await fetch(
        `/api/games/providers/${providerKey}/games/play-style`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameCode: title.gameCode, playMode }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      onChanged({ playModeOverride: playMode ?? undefined });
      toast.success(
        `${title.displayName} is now played "${PLAY_MODE_COPY.get(data.effective as PlayMode)?.label}".`,
      );
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Select
          value={title.playModeOverride ?? FOLLOW}
          disabled={saving}
          onValueChange={save}
        >
          <SelectTrigger className="h-8 w-[200px] border-white/15 bg-white/5 text-xs text-white/90">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FOLLOW}>
              Provider&apos;s choice — {PLAY_MODE_COPY.get(declared)?.label}
            </SelectItem>
            {PLAY_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {PLAY_MODE_COPY.get(mode)?.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
      </div>
      <p className="max-w-[260px] text-xs text-white/40">{copy?.detail}</p>

      {/*
        THE SECOND DECISION, BELOW THE FIRST AND DELIBERATELY NOT MERGED INTO IT (task
        document 11). The select above says what this game IS; these say what a contest on it
        may be created as. They are separate controls because they answer separate questions
        and each carries its own audit line, and the route refuses a request carrying both.

        Ordered this way round because the style constrains the set: it is the one member that
        cannot be unticked, so an operator meets the rule after they have set the thing the
        rule is about.
      */}
      <SupportedModes
        providerKey={providerKey}
        title={title}
        effective={effective}
        onChanged={onChanged}
      />
    </div>
  );
}

/**
 * Which shapes a contest on this title may be created as (task document 11).
 *
 * CHECKBOXES, NOT A SECOND SELECT, because the answer is a set rather than a choice - and a
 * multi-select that renders as a single line is where an operator loses track of what is
 * ticked on the one screen where that decides how a paid contest runs.
 *
 * THE GAME'S OWN STYLE IS SHOWN TICKED AND LOCKED, never merely absent from the list. The
 * resolver unions it in whatever is stored, so a tickable box for it would come back ticked
 * after an operator turned it off - the "control that appears to work and does nothing" shape
 * this codebase keeps finding. The lock plus the sentence beneath is the honest version, and
 * it points at the control that does change it.
 */
function SupportedModes({
  providerKey,
  title,
  effective,
  onChanged,
}: {
  providerKey: string;
  title: ProviderTitleRow;
  /** The game's own resolved style. The one member of the set that cannot be removed. */
  effective: PlayMode;
  onChanged: (next: { supportedPlayModes?: string[] }) => void;
}) {
  const [saving, setSaving] = useState(false);

  // RESOLVED, never the raw stored array. Two reasons, and both have bitten this programme:
  // the resolver unions the game's own style in, so the raw value renders a box unticked that
  // is about to behave as ticked; and it orders by `PLAY_MODES`, so two rows meaning the same
  // thing cannot present the pair of boxes the other way round.
  const supported = resolveSupportedPlayModes(title);

  const toggle = async (mode: PlayMode, next: boolean) => {
    // Guarded here as well as in the service, because the box is rendered disabled and a
    // disabled box is a UI state rather than a rule. The service's refusal is what makes it
    // true; this is what stops a stray call reaching it.
    if (mode === effective) return;

    const modes = next
      ? [...supported, mode]
      : supported.filter((entry) => entry !== mode);

    setSaving(true);
    try {
      const response = await fetch(
        `/api/games/providers/${providerKey}/games/play-style`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // `supportedPlayModes` alone. The route refuses a body carrying `playMode` too, so
          // this cannot be "helpfully" combined with the select above.
          body: JSON.stringify({ gameCode: title.gameCode, supportedPlayModes: modes }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      // The server's resolved answer, not the array we sent, so the boxes settle on what a
      // contest can actually be created as.
      onChanged({ supportedPlayModes: data.supported as string[] });
      toast.success(
        `Contests on ${title.displayName} can be created as: ${(data.supported as PlayMode[])
          .map((mode) => PLAY_MODE_COPY.get(mode)?.label ?? mode)
          .join(", ")}.`,
      );
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-white/35">
        A contest may be created as
      </p>
      {PLAY_MODES.map((mode) => {
        const locked = mode === effective;
        return (
          <label
            key={mode}
            className={`flex items-center gap-2 text-xs ${
              locked ? "text-white/50" : "cursor-pointer text-white/80"
            }`}
          >
            <input
              type="checkbox"
              checked={supported.includes(mode)}
              disabled={saving || locked}
              onChange={(event) => toggle(mode, event.target.checked)}
              className="h-3 w-3 rounded border-white/20 bg-white/5"
            />
            <span>{PLAY_MODE_COPY.get(mode)?.label}</span>
            {locked && <Lock className="h-3 w-3 shrink-0 text-white/30" />}
          </label>
        );
      })}
      <p className="max-w-[260px] text-xs text-white/40">
        Tick a second style to let an operator choose per contest. This game&apos;s own style
        cannot be unticked — change it in the box above instead.
      </p>
    </div>
  );
}
