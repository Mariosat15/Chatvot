/**
 * Volt Velocity's catalogue copy and race rules, in every locale the title declares.
 *
 * Kept beside the title rather than in `content.ts`, which is shared by the Circuit titles and
 * Volt Stack and has no room left for a fourth set. `content.ts` imports this module; this
 * module imports only types, so there is no cycle.
 *
 * WHAT THE COPY MUST NOT SAY: a lap count or a fixed race length. The operator picks 1-10 laps
 * per competition (a challenge is always 3), and whether everybody races together or each
 * player races alone, so a number or a "together" claim in catalogue copy would be false for
 * some contest. The per-lap limit (100 seconds) is the one timing fact true of every race.
 */

import type { TitleCopy } from "../content";
import type { SupportedLocale } from "../locale";

export const VOLT_VELOCITY_COPY: Record<SupportedLocale, TitleCopy> = {
  en: {
    displayName: "Volt Velocity",
    tagline: "Up to 16 pilots. One track. Fastest time wins.",
    description:
      "A live anti-gravity race. Pick your ship and race the full distance on the contest's " +
      "track - against the whole field at once, or on your own against the clock, depending " +
      "on the contest.",
    rulesSummary:
      "Lowest finishing time wins; if two times are equal, more points wins. Nothing you pick " +
      "up can touch another pilot - weapons only clear towers, and shields, repairs and boosts " +
      "help only you. If you disconnect your ship stops and the clock keeps running: reconnect " +
      "within 30 seconds to carry on; after that you are out with no score, and dropping out " +
      "does not return your entry fee. A race cancelled before it starts is refunded in full; if " +
      "a fault on our side stops a race, the contest's stated rule for unfinished rounds applies. A " +
      "pilot who does not finish, or is not connected when the race starts, records no score. " +
      "The race server times every lap.",
    pacingNote:
      "The race starts after a five-second countdown and allows 100 seconds per lap; anybody " +
      "still racing when that runs out does not finish.",
  },
  el: {
    displayName: "Volt Velocity",
    tagline: "Έως 16 πιλότοι. Μία πίστα. Κερδίζει ο ταχύτερος χρόνος.",
    description:
      "Ζωντανός αγώνας αντιβαρύτητας. Διάλεξε σκάφος και ολοκλήρωσε την απόσταση στην πίστα " +
      "του διαγωνισμού - μαζί με όλους τους υπόλοιπους, ή μόνος σου απέναντι στο χρονόμετρο, " +
      "ανάλογα με τον διαγωνισμό.",
    rulesSummary:
      "Κερδίζει ο χαμηλότερος χρόνος τερματισμού· σε ισοπαλία χρόνου κερδίζουν οι περισσότεροι " +
      "πόντοι. Τίποτα από όσα μαζεύεις δεν επηρεάζει άλλο πιλότο - τα όπλα καθαρίζουν μόνο " +
      "πύργους, ενώ ασπίδες, επισκευές και boost βοηθούν μόνο εσένα. Αν αποσυνδεθείς, το σκάφος " +
      "σταματά και το χρονόμετρο συνεχίζει: επανασυνδέσου μέσα σε 30 δευτερόλεπτα για να " +
      "συνεχίσεις, αλλιώς αποκλείεσαι χωρίς σκορ και η αποχώρηση δεν επιστρέφει το κόστος " +
      "συμμετοχής. Αγώνας που ακυρώνεται πριν ξεκινήσει επιστρέφεται πλήρως· αν βλάβη από τη " +
      "δική μας πλευρά σταματήσει τον αγώνα, ισχύει ο δηλωμένος κανόνας του διαγωνισμού για " +
      "ημιτελείς γύρους. Όποιος δεν τερματίσει, ή δεν είναι συνδεδεμένος στην εκκίνηση, δεν καταγράφει " +
      "σκορ. Ο διακομιστής χρονομετρεί κάθε γύρο.",
    pacingNote:
      "Ο αγώνας ξεκινά μετά από αντίστροφη μέτρηση πέντε δευτερολέπτων και δίνει 100 " +
      "δευτερόλεπτα ανά γύρο· όποιος τρέχει ακόμη όταν τελειώσει ο χρόνος δεν τερματίζει.",
  },
};

export const VOLT_VELOCITY_RULES_BY_LOCALE: Record<SupportedLocale, readonly string[]> = {
  en: [
    "Join the lobby and pick one of the eight ships - each trades speed, handling, hull and boost differently.",
    "Press Ready when you are set. You race even if you do not, as long as you are connected when the race starts.",
    "Steer, accelerate and brake around every lap of the race. Boost drains energy; pickups refill it, repair your hull, or give you a shield or a missile.",
    "Weapons only destroy towers on the track - nothing you collect can slow, damage or block another pilot. Ships that touch bounce apart without damage, and every pilot collects every pickup for themselves.",
    "Your starting place on the grid comes from your Volt Velocity points: most points at the front, then whoever joined first.",
    "If you disconnect, your ship stops and the clock keeps running. Reconnect within 30 seconds to carry on; after that you are out with no score, and dropping out does not return your entry fee. A race cancelled before it starts is refunded in full; if a fault on our side stops a race, the contest's stated rule for unfinished rounds applies.",
    "Leaving the track or losing your hull respawns you and costs time. Every pilot races the same track with the same pickups.",
  ],
  el: [
    "Μπες στο lobby και διάλεξε ένα από τα οκτώ σκάφη - το καθένα ζυγίζει διαφορετικά ταχύτητα, χειρισμό, θωράκιση και boost.",
    "Πάτα Ready όταν είσαι έτοιμος. Τρέχεις ακόμη κι αν δεν το πατήσεις, αρκεί να είσαι συνδεδεμένος στην εκκίνηση.",
    "Στρίψε, επιτάχυνε και φρέναρε σε κάθε γύρο του αγώνα. Το boost καταναλώνει ενέργεια· τα pickups την αναπληρώνουν, επισκευάζουν ή δίνουν ασπίδα ή πύραυλο.",
    "Τα όπλα καταστρέφουν μόνο πύργους στην πίστα - τίποτα από όσα μαζεύεις δεν επιβραδύνει, δεν βλάπτει και δεν μπλοκάρει άλλο πιλότο. Τα σκάφη που ακουμπούν αναπηδούν χωρίς ζημιά, και κάθε πιλότος μαζεύει κάθε pickup για τον εαυτό του.",
    "Η θέση σου στην εκκίνηση βγαίνει από τους πόντους σου στο Volt Velocity: όσοι έχουν τους περισσότερους μπροστά, μετά όποιος μπήκε πρώτος.",
    "Αν αποσυνδεθείς, το σκάφος σταματά και το χρονόμετρο συνεχίζει. Επανασυνδέσου μέσα σε 30 δευτερόλεπτα για να συνεχίσεις· μετά αποκλείεσαι χωρίς σκορ και η αποχώρηση δεν επιστρέφει το κόστος συμμετοχής. Αγώνας που ακυρώνεται πριν ξεκινήσει επιστρέφεται πλήρως· αν βλάβη από τη δική μας πλευρά σταματήσει τον αγώνα, ισχύει ο δηλωμένος κανόνας του διαγωνισμού για ημιτελείς γύρους.",
    "Αν βγεις από την πίστα ή χάσεις τη θωράκιση, επανεμφανίζεσαι και χάνεις χρόνο. Όλοι τρέχουν την ίδια πίστα με τα ίδια pickups.",
  ],
};
