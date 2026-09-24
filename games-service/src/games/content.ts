/**
 * Localised catalogue copy and board rules for ChartVolt Games titles.
 *
 * WHY A SEPARATE MODULE
 * ---------------------
 * `titles.ts` holds capabilities, scoring and schema — facts that do not change
 * by language. Copy does. Keeping them apart means Accept-Language can swap
 * strings without touching the contract fields the platform ranks and settles
 * on, and a missing translation fails closed to English rather than shipping
 * a half-translated title object.
 *
 * A11: every field below is a flat string. There are no per-field locale maps.
 * A12: declaring `el` is only honest once these Greek strings exist.
 */

import { DEFAULT_LOCALE, type SupportedLocale } from "./locale";
import { PERFECT_CODE } from "./titles-codes";

/**
 * One title's player-facing text in one language.
 *
 * `pacingNote` is the sentence that cannot be shared across titles (Sprint
 * advances on solve; Perfect's clock runs across the set). `howToPlay` is
 * composed from the shared board rules plus this note.
 */
export interface TitleCopy {
  displayName: string;
  tagline: string;
  description: string;
  rulesSummary: string;
  pacingNote: string;
}

/**
 * The four things a player has to know to play a board.
 *
 * Shared across titles and composed into catalogue `howToPlay`. See
 * `instructions.ts` for why this list must not live in markup.
 */
export const BOARD_RULES_BY_LOCALE: Record<SupportedLocale, readonly string[]> = {
  en: [
    "Drag from one terminal to the terminal with the same number to draw a path.",
    "Paths cannot cross each other or themselves.",
    "Every square on the grid must be used.",
    "Drag a path again to redraw it.",
  ],
  el: [
    "Σύρε από ένα τερματικό στο τερματικό με τον ίδιο αριθμό για να σχεδιάσεις μια διαδρομή.",
    "Οι διαδρομές δεν μπορούν να τέμνονται μεταξύ τους ούτε με τον εαυτό τους.",
    "Κάθε τετράγωνο στο πλέγμα πρέπει να χρησιμοποιηθεί.",
    "Σύρε ξανά μια διαδρομή για να την ξανασχεδιάσεις.",
  ],
};

/** English board rules — the historical export shape tests and play already import. */
export const BOARD_RULES = BOARD_RULES_BY_LOCALE.en;

const SPRINT_COPY: Record<SupportedLocale, TitleCopy> = {
  en: {
    displayName: "Circuit Sprint",
    tagline: "Wire the grid. Beat the clock. As many boards as you can.",
    description:
      "A fast spatial puzzle. Each board has pairs of matching terminals, and you connect " +
      "each pair with a path so that no two paths cross and every square is used. Solve as " +
      "many boards as you can before the timer runs out. Every player in a contest gets the " +
      "same boards in the same order.",
    rulesSummary:
      "1,000 points for every board you complete, plus a speed bonus of up to 200 for solving " +
      "quickly. An unfinished board scores nothing. Highest total wins; ties are broken by the " +
      "time of your last completed board.",
    pacingNote: "The next board appears as soon as you complete one.",
  },
  el: {
    displayName: "Circuit Sprint",
    tagline: "Σύνδεσε το πλέγμα. Νίκησε τον χρόνο. Όσα περισσότερα boards μπορείς.",
    description:
      "Ένα γρήγορο χωρικό παζλ. Κάθε board έχει ζεύγη τερματικών με τον ίδιο αριθμό, και " +
      "συνδέεις κάθε ζεύγος με μια διαδρομή ώστε να μην τέμνονται και να χρησιμοποιείται κάθε " +
      "τετράγωνο. Λύσε όσα περισσότερα boards μπορείς πριν τελειώσει ο χρόνος. Κάθε παίκτης σε " +
      "έναν διαγωνισμό παίρνει τα ίδια boards με την ίδια σειρά.",
    rulesSummary:
      "1.000 πόντοι για κάθε board που ολοκληρώνεις, συν μπόνους ταχύτητας έως 200 για γρήγορη " +
      "λύση. Ένα ημιτελές board δεν βαθμολογείται. Κερδίζει το υψηλότερο σύνολο· οι ισοπαλίες " +
      "λύνονται από τον χρόνο του τελευταίου ολοκληρωμένου board.",
    pacingNote: "Το επόμενο board εμφανίζεται μόλις ολοκληρώσεις ένα.",
  },
};

const PERFECT_COPY: Record<SupportedLocale, TitleCopy> = {
  en: {
    displayName: "Circuit Perfect",
    tagline: "Five boards. One clock. Every square counts.",
    description:
      "The same spatial puzzle as Circuit Sprint, scored the other way round. You are given a " +
      "fixed set of boards and your score is the total time you take to finish them all, so " +
      "the fastest player wins. Every player in a contest gets the same boards in the same " +
      "order.",
    rulesSummary:
      "Your score is your total time in milliseconds, and the LOWEST score wins. Every board " +
      "you leave unfinished adds a two-minute penalty to your time, so finishing all of them is " +
      "always better than rushing and giving up. Ties are broken by the number of boards " +
      "completed.",
    pacingNote:
      "The clock runs from your first move to your last, so a board you are still thinking " +
      "about is still costing you.",
  },
  el: {
    displayName: "Circuit Perfect",
    tagline: "Πέντε boards. Ένα ρολόι. Κάθε τετράγωνο μετράει.",
    description:
      "Το ίδιο χωρικό παζλ με το Circuit Sprint, βαθμολογημένο αντίστροφα. Παίρνεις ένα " +
      "σταθερό σύνολο boards και το σκορ σου είναι ο συνολικός χρόνος μέχρι να τα τελειώσεις " +
      "όλα — άρα κερδίζει ο πιο γρήγορος. Κάθε παίκτης σε έναν διαγωνισμό παίρνει τα ίδια " +
      "boards με την ίδια σειρά.",
    rulesSummary:
      "Το σκορ σου είναι ο συνολικός χρόνος σε χιλιοστά του δευτερολέπτου, και κερδίζει το " +
      "ΧΑΜΗΛΟΤΕΡΟ σκορ. Κάθε board που αφήνεις ημιτελές προσθέτει ποινή δύο λεπτών, οπότε " +
      "η ολοκλήρωση όλων είναι πάντα καλύτερη από τη βιασύνη και την εγκατάλειψη. Οι ισοπαλίες " +
      "λύνονται από τον αριθμό των ολοκληρωμένων boards.",
    pacingNote:
      "Το ρολόι μετράει από την πρώτη σου κίνηση μέχρι την τελευταία, οπότε ένα board που " +
      "ακόμα σκέφτεσαι σου κοστίζει χρόνο.",
  },
};

function asSupported(locale: string): SupportedLocale {
  return locale === "el" ? "el" : DEFAULT_LOCALE;
}

/**
 * Board rules for a locale. Unknown tags fall back to English — never to an
 * empty list, which would leave the intro panel blank on a paid round.
 */
export function boardRulesFor(locale: string): readonly string[] {
  const supported = asSupported(locale);
  return supported === "el" ? BOARD_RULES_BY_LOCALE.el : BOARD_RULES_BY_LOCALE.en;
}

/**
 * Catalogue / intro copy for a title in a locale.
 *
 * Falls back to English when the locale or game code is unknown, so a stale
 * round whose title left the catalogue still has something to show.
 */
export function copyFor(gameCode: string, locale: string): TitleCopy {
  // Reason: branch on known codes rather than indexing a Record — the security
  // linter treats any dynamic key as an injection sink, and we only have two titles.
  const table = gameCode === PERFECT_CODE ? PERFECT_COPY : SPRINT_COPY;
  const supported = asSupported(locale);
  return supported === "el" ? table.el : table.en;
}

export function howToPlayProse(rules: readonly string[], pacingNote: string): string {
  return [...rules, pacingNote].join(" ");
}

export function howToPlayFor(gameCode: string, locale: string): string {
  const copy = copyFor(gameCode, locale);
  return howToPlayProse(boardRulesFor(locale), copy.pacingNote);
}

/** Locales every ChartVolt Games title declares once Greek copy exists. */
export const TITLE_LOCALES: SupportedLocale[] = ["en", "el"];
