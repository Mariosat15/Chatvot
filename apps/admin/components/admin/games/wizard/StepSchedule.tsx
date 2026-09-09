"use client";

import { Coins, Percent, Users } from "lucide-react";
import {
  playShapeRules,
  type PlayMode,
} from "@/lib/services/games/play-shape";
import { RoundClockNote } from "../RoundClockNote";
import { RoundStartPolicyField } from "../RoundStartPolicyField";
import type { ContestDraft } from "../contest-draft";
import type { ContestableTitle } from "../contest-types";
import { DateField, NumberField } from "./fields";
import { DEFAULT_CREDIT_SYMBOL } from "@/lib/utils/format-volts";

/**
 * Step four: the contest's clock, its fee and how many players it takes.
 *
 * THE PLAY WINDOW USED TO BE TWO MORE DATE FIELDS HERE, AND REMOVING THEM WAS NOT A
 * SIMPLIFICATION - it is the fix for a contest that could not do what a contest is for.
 *
 * Four dates let an operator open play at a different moment from the contest, which sounds
 * like flexibility and is really a way to build a contest nobody can win fairly: players who
 * started earlier got a longer run at it, and the field named "ends" gated nothing a player
 * played inside. The owner's requirement is one clock for everybody - the contest opens, every
 * player has exactly the same window, it closes, every round closes with it and settlement
 * runs.
 *
 * So the window is DERIVED from the contest, in `contest-draft.ts`, and there is nothing to
 * set. Entry is not squeezed by this: registration closes at `startTime`, so an operator who
 * wants five minutes of sign-up time creates the contest five minutes before it starts. That
 * is what the trading wizard already does.
 */
export function StepSchedule({
  draft,
  patch,
  title,
  creditSymbol,
}: {
  draft: ContestDraft;
  patch: (changes: Partial<ContestDraft>) => void;
  /**
   * The chosen catalogue row, needed only so the clock note can find the playing time.
   *
   * IT TAKES THE WHOLE TITLE RATHER THAN `maxDurationSeconds`, which is the change that
   * fixed the note. The reserved time is the operator's own chosen playing length, found
   * through the `format` keyword on the title's settings schema - so the note needs the
   * schema and the draft's answers, and the ceiling only as a fallback for a title that
   * declares no clock.
   */
  title?: {
    maxDurationSeconds?: number;
    schema: ContestableTitle["schema"];
    playMode?: PlayMode;
  };
  /** `AppSettings.credits.symbol`. An entry fee is a credit amount. */
  creditSymbol?: string;
}) {
  // Resolved from the chosen title, and `anytime` before one is chosen - which is the same
  // answer the whole live catalogue gives, so the step reads identically until it needs not to.
  const shape = playShapeRules(title?.playMode ?? "anytime");

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField
          label={shape.copy.startLabel}
          value={draft.startTime}
          onChange={(v) => patch({ startTime: v })}
          hint={shape.copy.startHint}
        />
        <DateField
          label={shape.copy.endLabel}
          value={draft.endTime}
          onChange={(v) => patch({ endTime: v })}
          hint={shape.copy.endHint}
        />
      </div>

      <RoundClockNote
        variant="timing"
        startTime={draft.startTime}
        endTime={draft.endTime}
        schemaFields={title?.schema.ok ? title.schema.fields : undefined}
        settings={draft.settings}
        maxDurationSeconds={title?.maxDurationSeconds}
        roundStartPolicy={draft.roundStartPolicy}
      />

      {/*
        Placed with the dates rather than with the round settings, because the question it
        answers is about the contest's clock - "when can people actually play?" - and it
        changes what the note directly above says. Two screens apart, an operator would read
        a cut-off, scroll, change the policy, and never see the note stop mentioning one.

        WITHHELD WITH ITS REASON on a simultaneous title, rather than greyed out or silently
        absent. The create service forces the policy for such a contest, so leaving the control
        here would be a setting an operator can change that changes nothing - the shape this
        codebase keeps finding, after a provider with no adapter and a `rankingMethod` a
        provider game ignores.
      */}
      {shape.offersRoundStartPolicy ? (
        <RoundStartPolicyField
          value={draft.roundStartPolicy}
          onChange={(value) => patch({ roundStartPolicy: value })}
        />
      ) : (
        <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
          {shape.copy.roundStartWithheld}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
            label={`Entry fee (${creditSymbol?.trim() || DEFAULT_CREDIT_SYMBOL})`}
          value={draft.entryFee}
          onChange={(v) => patch({ entryFee: v })}
          icon={Coins}
          iconClassName="text-green-400"
          min={0}
        />
        <NumberField
          label="Min players"
          value={draft.minParticipants}
          onChange={(v) => patch({ minParticipants: v })}
          icon={Users}
          iconClassName="text-blue-400"
          min={2}
        />
        <NumberField
          label="Max players"
          value={draft.maxParticipants}
          onChange={(v) => patch({ maxParticipants: v })}
          icon={Users}
          iconClassName="text-blue-400"
          min={2}
        />
        {/*
          Missing until now, and silently: the draft carried `platformFeePercentage: 10` and
          the wizard never rendered it, so every provider contest took ten per cent whatever
          the operator wanted. The editor has always exposed it, which is the worse version of
          the bug - the setting appears once the contest exists, so it reads as a field the
          operator forgot rather than one they were never offered.
        */}
        <NumberField
          label="Platform fee %"
          value={draft.platformFeePercentage}
          onChange={(v) => patch({ platformFeePercentage: v })}
          icon={Percent}
          iconClassName="text-yellow-400"
          min={0}
        />
      </div>

      <p className="text-xs text-gray-500">
        Below the minimum the contest auto-cancels and every entry fee is refunded in
        full, with no platform fee taken.
      </p>
    </>
  );
}
