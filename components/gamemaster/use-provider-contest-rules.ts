"use client";

import { useState } from "react";
import type { ConfigField } from "@/lib/services/games/config-schema";
import { resolveAttemptSeconds } from "@/lib/services/games/config-schema";
import {
  clampGmRoundStartPolicy,
  gmAllowedRoundStartPolicies,
  playShapeRules,
} from "@/lib/services/games/play-shape";
import type { PlayMode } from "@/lib/services/games/play-shape";
import {
  deriveResultGraceSeconds,
  describeRoundFit,
} from "@/lib/services/games/round-fit";
import type {
  AttemptsPolicy,
  RoundStartPolicy,
} from "@/lib/services/games/round-types";
import {
  NO_GAME_MASTER_DEFAULTS,
  type GameMasterDefaultsLookup,
} from "@/components/gamemaster/competition-defaults-lookup";

/**
 * The grace period a Game Master contest starts from. Only ever raised, by
 * `deriveResultGraceSeconds`, when the game's playing time needs more.
 */
export const GM_RESULT_GRACE_FLOOR_SECONDS = 900;

/** Used when a creator first picks "best of" or "total of" and the admin set no count. */
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
  /**
   * Admin "A Competition may be created as" set for this title. Gates which
   * last-attempt options the GM may pick (owner, 1 Oct 2026).
   */
  supportedPlayModes: PlayMode[];
  fields: ConfigField[];
  settings: Record<string, unknown>;
  maxDurationSeconds?: number;
  startTime: string;
  endTime: string;
  /** Admin competition defaults: the starting attempts values and which are locked. */
  defaults?: GameMasterDefaultsLookup;
}) {
  const defaults = input.defaults ?? NO_GAME_MASTER_DEFAULTS;
  const defaultAttemptsPolicy = defaults.valueOf<AttemptsPolicy>("attemptsPolicy", "single");
  const defaultAttemptsCount = defaults.valueOf<number>(
    "attemptsAllowed",
    DEFAULT_SEVERAL_ATTEMPTS,
  );
  const allowedRoundStart = gmAllowedRoundStartPolicies(input.supportedPlayModes);
  const initialShape = playShapeRules(input.initialPlayMode);
  const [playMode, setPlayModeState] = useState<PlayMode>(input.initialPlayMode);
  const initialAttemptsPolicy = initialShape.forcedAttemptsPolicy ?? defaultAttemptsPolicy;
  const [attemptsPolicy, setAttemptsPolicyState] =
    useState<AttemptsPolicy>(initialAttemptsPolicy);
  const [attemptsAllowed, setAttemptsAllowed] = useState<number | undefined>(
    initialAttemptsPolicy === "single" ? undefined : defaultAttemptsCount,
  );
  const [roundStartPolicy, setRoundStartPolicyState] = useState<RoundStartPolicy>(
    initialShape.forcedRoundStartPolicy ??
      clampGmRoundStartPolicy(undefined, input.supportedPlayModes) ??
      "until_window_closes",
  );

  const shape = playShapeRules(playMode);

  function selectPlayMode(mode: PlayMode) {
    const next = playShapeRules(mode);
    setPlayModeState(mode);
    const policy = next.forcedAttemptsPolicy ?? defaultAttemptsPolicy;
    setAttemptsPolicyState(policy);
    setAttemptsAllowed(policy === "single" ? undefined : defaultAttemptsCount);
    setRoundStartPolicyState(
      next.forcedRoundStartPolicy ??
        clampGmRoundStartPolicy(undefined, input.supportedPlayModes) ??
        "until_window_closes",
    );
  }

  function setAttemptsPolicy(policy: AttemptsPolicy) {
    setAttemptsPolicyState(policy);
    if (policy === "single") setAttemptsAllowed(undefined);
    else setAttemptsAllowed((n) => n ?? defaultAttemptsCount);
  }

  function setRoundStartPolicy(policy: RoundStartPolicy) {
    // Reason: never store a policy the admin settings have withdrawn — a stale
    // select option or a hand-crafted request would otherwise survive until save.
    setRoundStartPolicyState(
      clampGmRoundStartPolicy(policy, input.supportedPlayModes) ?? policy,
    );
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
    /** The admin locked these: the control is hidden and the admin value is sent. */
    attemptsPolicyLocked: defaults.isLocked("attemptsPolicy"),
    attemptsAllowedLocked: defaults.isLocked("attemptsAllowed"),
    roundStartPolicy,
    setRoundStartPolicy,
    /** Policies the admin settings still allow; the dropdown is built from this. */
    allowedRoundStartPolicies: allowedRoundStart,
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
