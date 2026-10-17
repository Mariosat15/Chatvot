import { findCompetitionDefaultOption } from "@/lib/services/gamemaster/competition-defaults";
import { checkOptionValue } from "@/lib/services/gamemaster/competition-defaults-apply";

/**
 * What a Game Master create form needs to know about one option: is it locked, and what
 * value does it start at. Built from the `competitionDefaults` the creation-options route
 * returns.
 *
 * Read on the client for DISPLAY only. The create route applies the defaults itself, so a
 * missing or malformed response makes the form show every option with its built-in starting
 * value - and a locked option is still overwritten by the server whatever the form sends.
 */
export interface GameMasterDefaultsLookup {
  isLocked(key: string): boolean;
  valueOf<T>(key: string, fallback: T): T;
}

interface Entry {
  value: unknown;
  locked: boolean;
}

export function readGameMasterDefaults(raw: unknown): GameMasterDefaultsLookup {
  // Reason: a Map, because the key comes from a response and an object lookup would walk
  // the prototype chain ("constructor" would read as a configured option).
  const entries = new Map<string, Entry>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const option = findCompetitionDefaultOption(item?.key);
      if (!option || typeof item.gmMayChange !== "boolean") continue;
      const check = checkOptionValue(option, item.value);
      // Reason: an invalid stored value is replaced by the shipped default on the server
      // too (`resolveCompetitionDefaults`), so the form agrees by ignoring it here.
      entries.set(option.key, {
        value: check.ok ? check.value : option.defaultValue,
        locked: !item.gmMayChange,
      });
    }
  }
  return {
    isLocked: (key) => entries.get(key)?.locked === true,
    valueOf: <T,>(key: string, fallback: T): T => {
      const entry = entries.get(key);
      return entry ? (structuredClone(entry.value) as T) : fallback;
    },
  };
}

/** The lookup used when no defaults are known: nothing locked, built-in values. */
export const NO_GAME_MASTER_DEFAULTS: GameMasterDefaultsLookup = readGameMasterDefaults([]);
