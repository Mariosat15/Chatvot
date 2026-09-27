/**
 * Volt Velocity's catalogue copy and race rules, in every locale the title declares.
 *
 * Kept beside the title rather than in `content.ts`, which is shared by the Circuit titles and
 * Volt Stack and has no room left for a fourth set. `content.ts` imports this module; this
 * module imports only types, so there is no cycle.
 *
 * WHAT THE COPY MUST NOT SAY: that a player can race whenever they like. The race has one
 * start time and one field, and a player who arrives after the gun has missed it. Every
 * sentence below that mentions time is about that.
 */

import type { TitleCopy } from "../content";
import type { SupportedLocale } from "../locale";

export const VOLT_VELOCITY_COPY: Record<SupportedLocale, TitleCopy> = {
  en: {
    displayName: "Volt Velocity",
    tagline: "Up to 16 pilots. One start. Three laps.",
    description:
      "A live anti-gravity race. Join the lobby before the start, pick your ship, and race " +
      "every other entrant at the same moment on the same track. Fastest three-lap time wins.",
    rulesSummary:
      "Lowest finishing time over three laps wins. A pilot who does not finish, or is not " +
      "connected when the race starts, records no time. The race server times every lap.",
    pacingNote:
      "Everyone starts together at the scheduled time after a five-second countdown. The race " +
      "closes five minutes after the start; anybody still racing then does not finish.",
  },
  el: {
    displayName: "Volt Velocity",
    tagline: "Έως 16 πιλότοι. Μία εκκίνηση. Τρεις γύροι.",
    description:
      "Ζωντανός αγώνας αντιβαρύτητας. Μπες στο lobby πριν την εκκίνηση, διάλεξε σκάφος και " +
      "τρέξε μαζί με όλους τους υπόλοιπους την ίδια στιγμή, στην ίδια πίστα. Κερδίζει ο " +
      "ταχύτερος χρόνος τριών γύρων.",
    rulesSummary:
      "Κερδίζει ο χαμηλότερος χρόνος τριών γύρων. Όποιος δεν τερματίσει, ή δεν είναι " +
      "συνδεδεμένος στην εκκίνηση, δεν καταγράφει χρόνο. Ο διακομιστής χρονομετρεί κάθε γύρο.",
    pacingNote:
      "Όλοι ξεκινούν μαζί στην προγραμματισμένη ώρα μετά από αντίστροφη μέτρηση πέντε " +
      "δευτερολέπτων. Ο αγώνας κλείνει πέντε λεπτά μετά την εκκίνηση.",
  },
};

export const VOLT_VELOCITY_RULES_BY_LOCALE: Record<SupportedLocale, readonly string[]> = {
  en: [
    "Join the lobby before the start time and pick one of the eight ships - each trades speed, handling, hull and boost differently.",
    "Press Ready when you are set. You race even if you do not, as long as you are connected when the race starts.",
    "Steer, accelerate and brake around three laps. Boost drains energy; pickups refill it, repair your hull or give you a shield or a weapon.",
    "Leaving the track or losing your hull respawns you and costs time. Every pilot races the same track with the same pickups.",
  ],
  el: [
    "Μπες στο lobby πριν την ώρα εκκίνησης και διάλεξε ένα από τα οκτώ σκάφη - το καθένα ζυγίζει διαφορετικά ταχύτητα, χειρισμό, θωράκιση και boost.",
    "Πάτα Ready όταν είσαι έτοιμος. Τρέχεις ακόμη κι αν δεν το πατήσεις, αρκεί να είσαι συνδεδεμένος στην εκκίνηση.",
    "Στρίψε, επιτάχυνε και φρέναρε για τρεις γύρους. Το boost καταναλώνει ενέργεια· τα pickups την αναπληρώνουν, επισκευάζουν ή δίνουν ασπίδα ή όπλο.",
    "Αν βγεις από την πίστα ή χάσεις τη θωράκιση, επανεμφανίζεσαι και χάνεις χρόνο. Όλοι τρέχουν την ίδια πίστα με τα ίδια pickups.",
  ],
};
