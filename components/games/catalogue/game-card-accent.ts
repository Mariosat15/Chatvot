/**
 * Per-game neon identity for catalogue cards.
 *
 * Reason (8 Oct 2026, owner Rebuild theGame Area): Image 1 gives each title its own
 * border/glow. Keyed on gameCode / kind — never nth-child — so a fifth title does not
 * inherit a neighbour's colour and a reorder does not reshuffle accents.
 */

export interface GameCardAccent {
  /** CSS color for border / CTA. */
  accent: string;
  /** Softer companion for glows. */
  accentSecondary: string;
  /** object-position for the card artwork. */
  objectPosition: string;
}

const VELOCITY: GameCardAccent = {
  accent: "#55C8FF",
  accentSecondary: "#85E8FF",
  objectPosition: "center center",
};

const STACK: GameCardAccent = {
  accent: "#C678FF",
  accentSecondary: "#E8B0FF",
  objectPosition: "center center",
};

const SPRINT: GameCardAccent = {
  accent: "#FFB040",
  accentSecondary: "#FFD447",
  objectPosition: "center center",
};

const TRADING: GameCardAccent = {
  accent: "#2EE6C8",
  accentSecondary: "#7FF5E0",
  objectPosition: "center 42%",
};

const DEFAULT_ACCENT: GameCardAccent = {
  accent: "#55C8FF",
  accentSecondary: "#85E8FF",
  objectPosition: "center center",
};

/** Explicit codes first; substring fallbacks for provider codes that grow a prefix. */
const BY_CODE: ReadonlyMap<string, GameCardAccent> = new Map([
  ["volt-velocity", VELOCITY],
  ["velocity", VELOCITY],
  ["volt-stack", STACK],
  ["stack", STACK],
  ["circuit-sprint", SPRINT],
  ["circuit-perfect", SPRINT],
  ["sprint", SPRINT],
  ["trading", TRADING],
]);

export function resolveGameCardAccent(input: {
  kind: string;
  gameKey: string;
  gameCode?: string;
}): GameCardAccent {
  if (input.kind === "trading") return TRADING;

  const code = (input.gameCode || "").trim().toLowerCase();
  if (code && BY_CODE.has(code)) return BY_CODE.get(code)!;

  const tail = input.gameKey.split(":").pop()?.toLowerCase() ?? "";
  if (tail && BY_CODE.has(tail)) return BY_CODE.get(tail)!;

  if (code.includes("velocity") || tail.includes("velocity")) return VELOCITY;
  if (code.includes("stack") || tail.includes("stack")) return STACK;
  if (
    code.includes("sprint") ||
    code.includes("circuit") ||
    tail.includes("sprint") ||
    tail.includes("circuit")
  ) {
    return SPRINT;
  }

  return DEFAULT_ACCENT;
}
