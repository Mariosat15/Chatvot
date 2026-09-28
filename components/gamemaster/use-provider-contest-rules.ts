"use client";

import { useState } from "react";
import type { ConfigField } from "@/lib/services/games/config-schema";
import { resolveAttemptSeconds } from "@/lib/services/games/config-schema";
import { playShapeRules } from "@/lib/services/games/play-shape";
import type { PlayMode } from "@/lib/services/games/play-shape";
import {
  deriveResultGraceSeconds,
  describeRoundFit,
} from "@/lib/services/games/round-fit";
import type {
  AttemptsPolicy,
  RoundStartPolicy,
} from "@/lib/services/games/round-types";

/**
 * The grace period a Game Master contest starts from. Only ever raised, by
 * `deriveResultGraceSeconds`, when the game's playing time needs more.
 */
export const GM_RESULT_GRACE_FLOOR_SECONDS = 900;

/** Used when a creator first picks "best of" or "total of" and has not chosen a count. */
const DEFAULT_SEVERAL_ATTEMPTS = 3;

/**
 * The round rules of a Game Master provider contest: play style, attempts, when the last
 * attempt may start, and the derived result grace.
 *
 * THE SAME FORCING AS THE ADMIN WIZARD'S `selectPlayMode`, from the same `playShapeRules`.
 * A synchronised race is one attempt and runs until the window closes, so choosing that shape
 * sets both values and withholds their controls. The create service forces them again at
 * write time; doing it here as well is what stops the form offering a choice the save then
 * overrides without saying so.
 */
export function useProviderContestRules(input: {
  initialPlayMode: PlayMode;
  fields: ConfigField[];
  settings: Record<string, unknown>;
  maxDurationSeconds?: number;
  startTime: string;
  endTime: string;
}) {
  const initialShape = playShapeRules(input.initialPlayMode);
  const [playMode, setPlayModeState] = useState<PlayMode>(input.initialPlayMode);
  const [attemptsPolicy, setAttemptsPolicyState] = useState<AttemptsPolicy>(
    initialShape.forcedAttemptsPolicy ?? "single",
  );
  const [attemptsAllowed, setAttemptsAllowed] = useState<number | undefined>();
  const [roundStartPolicy, setRoundStartPolicy] = useState<RoundStartPolicy>(
    initialShape.forcedRoundStartPolicy ?? "reserve_full_round",
  );

  const shape = playShapeRules(playMode);

  function selectPlayMode(mode: PlayMode) {
    const next = playShapeRules(mode);
    setPlayModeState(mode);
    setAttemptsPolicyState(next.forcedAttemptsPolicy ?? "single");
    if (next.forcedAttemptsPolicy) setAttemptsAllowed(undefined);
    setRoundStartPolicy(next.forcedRoundStartPolicy ?? "reserve_full_round");
  }

  function setAttemptsPolicy(policy: AttemptsPolicy) {
    setAttemptsPolicyState(policy);
    if (policy === "single") setAttemptsAllowed(undefined);
    else setAttemptsAllowed((n) => n ?? DEFAULT_SEVERAL_ATTEMPTS);
  }

  const attemptSeconds = resolveAttemptSeconds(
    input.fields,
    input.settings,
    input.maxDurationSeconds,
  );
  const fit = describeRoundFit({
    startTime: input.startTime,
    endTime: input.endTime,
    schemaFields: input.fields,
    settings: input.settings,
    maxDurationSeconds: input.maxDurationSeconds,
    roundStartPolicy,
  });
  const resultGracePeriodSeconds = deriveResultGraceSeconds(
    GM_RESULT_GRACE_FLOOR_SECONDS,
    attemptSeconds,
  );

  /**
   * The schedule step's refusal. Too short is a refusal only where the server refuses too:
   * reserving a full round (nobody could start) or a synchronised race (nobody could finish).
   * Under "until the window closes" a short contest is legitimate, every round simply shortened.
   */
  function scheduleError(): string | null {
    if (fit?.windowTooShort && (fit.reservesFullRound || playMode === "scheduled")) {
      return "The competition is shorter than one attempt. Use the button to make it long enough.";
    }
    if (attemptsPolicy !== "single" && !(Number(attemptsAllowed) >= 2)) {
      return "Choose how many attempts each player gets (at least 2).";
    }
    return null;
  }

  return {
    playMode,
    shape,
    selectPlayMode,
    attemptsPolicy,
    setAttemptsPolicy,
    attemptsAllowed,
    setAttemptsAllowed,
    roundStartPolicy,
    setRoundStartPolicy,
    fit,
    resultGracePeriodSeconds,
    scheduleError,
    /** The request fields, so the POST cannot drift from what the form showed. */
    requestFields: {
      playMode,
      attemptsPolicy,
      attemptsAllowed: attemptsPolicy === "single" ? undefined : attemptsAllowed,
      roundStartPolicy,
      resultGracePeriodSeconds,
    },
  };
}

export type ProviderContestRules = ReturnType<typeof useProviderContestRules>;
