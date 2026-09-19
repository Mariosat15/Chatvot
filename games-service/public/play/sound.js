/**
 * Circuit - the sounds, and nothing else.
 *
 * WHAT IS HERE AND WHAT IS IN `presentation.js`
 * --------------------------------------------
 * Every number about a sound - its pitch, its shape, how long it lasts, how loud it is, which
 * note a pair gets - is in `presentation.js`, where a test can read it without a browser. This
 * file holds only the Web Audio calls, which is the part no test in this service can drive. The
 * split is the same one that made the board's size and the result screen's wording provable, and
 * it is the reason there is not a single frequency literal below.
 *
 * THREE RULES THIS FILE EXISTS TO KEEP, IN ORDER OF HOW BADLY EACH ONE FAILS
 * ------------------------------------------------------------------------
 * 1. NOTHING HERE IS EVER AWAITED. There is no `async` and no `await` in this file, and every
 *    entry point returns `undefined`, so there is nothing on the gameplay path a caller could
 *    wait for even by accident. `AudioContext.resume()` returns a promise and the tempting thing
 *    is to await it before playing the Start sound - which would put an audio device between the
 *    player's tap and the POST that starts their clock. On a timed title the clock IS the score.
 *
 * 2. A BROKEN AUDIO STACK IS A SILENT GAME, NEVER A BROKEN ONE. Every call is inside a try/catch
 *    and the first failure sets `broken`, after which this object does nothing at all. Safari
 *    refuses a context in some embedded configurations, a locked-down browser removes the
 *    constructor, and a phone that has run out of audio contexts throws on construction. In all
 *    three the player must get a game that plays perfectly and makes no noise.
 *
 * 3. THE CONTEXT IS CREATED FROM A USER GESTURE. Browsers start an `AudioContext` suspended until
 *    one, and a context created at page load is one that never produces a sound however many
 *    times it is asked. `unlock()` is called from the Start button's own click handler, which is
 *    the one gesture every played round is guaranteed to have.
 */

import {
  SOUND_PREFERENCE_KEY,
  boardCompleteNotes,
  pairNoteRecipe,
  soundEnabledFrom,
  soundPreferenceValue,
  toneRecipe,
} from "./presentation.js";

/** A 6ms fade in and out of every note. See `playRecipe` - without it each one is a click. */
const EDGE_S = 0.006;

/**
 * Read the player's mute choice.
 *
 * The read is wrapped because `localStorage` THROWS rather than returning null when a browser
 * refuses it - Safari in private browsing, and any host page loaded with third-party storage
 * blocked, which an iframe on somebody else's domain very much is. An unhandled throw here would
 * happen at module scope and take the whole module graph down with it, which is the failure that
 * shows the player a loading spinner for ever.
 */
function readPreference() {
  try {
    return soundEnabledFrom(window.localStorage.getItem(SOUND_PREFERENCE_KEY));
  } catch {
    return soundEnabledFrom(null);
  }
}

function writePreference(enabled) {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, soundPreferenceValue(enabled));
  } catch {
    /* The choice holds for this round and is forgotten. Better than refusing the tap. */
  }
}

/**
 * The sound this round makes.
 *
 * Created once by `app.js` at module scope, which is why the preference read has to survive a
 * browser with no storage: see `readPreference`.
 */
export function createSound() {
  let enabled = readPreference();
  let context = null;
  let broken = false;

  /**
   * Bring the context up, without waiting for it.
   *
   * `resume()` returns a promise and it is deliberately not awaited - see rule 1 in the header.
   * The rejection is swallowed because an unhandled one is a red line in the player's console
   * that says nothing useful and looks, to anybody they report it to, like the game failing.
   */
  function resume() {
    if (!context || context.state !== "suspended") return;
    try {
      const pending = context.resume();
      if (pending && typeof pending.catch === "function") pending.catch(() => {});
    } catch {
      broken = true;
    }
  }

  function unlock() {
    if (broken) return;
    if (context) {
      resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        broken = true;
        return;
      }
      context = new Ctor();
    } catch {
      // A phone that has run out of contexts, or a browser that refuses one in a frame.
      broken = true;
      context = null;
      return;
    }
    resume();
  }

  /**
   * One note: an oscillator through a gain envelope, scheduled and forgotten.
   *
   * The envelope is the part that is not obvious. A gain stepping straight from 0 to full and back
   * produces a click at each end, and on a phone speaker the click is louder than the note - so a
   * quiet game ends up sounding like a fault. `EDGE_S` of ramp at each end removes it, and the
   * tail is exponential because a linear fade to zero still clicks.
   */
  function playRecipe(recipe) {
    if (!enabled || broken || !context || !recipe) return;
    try {
      const seconds = Math.max(0.02, recipe.ms / 1000);
      const at = context.currentTime + Math.max(0, (recipe.delayMs || 0) / 1000);
      const ends = at + seconds;

      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = recipe.type;
      osc.frequency.setValueAtTime(recipe.fromHz, at);
      if (recipe.toHz !== recipe.fromHz) {
        // Exponential rather than linear because pitch is heard logarithmically: a linear slide
        // between two notes spends most of its time near the top one and reads as a chirp.
        osc.frequency.exponentialRampToValueAtTime(recipe.toHz, ends);
      }

      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(recipe.gain, at + EDGE_S);
      gain.gain.setValueAtTime(recipe.gain, Math.max(at + EDGE_S, ends - EDGE_S));
      gain.gain.exponentialRampToValueAtTime(0.0001, ends);

      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(at);
      osc.stop(ends + EDGE_S);

      /*
       * An `OscillatorNode` is single-use, and a stopped one that is still connected keeps its
       * gain node alive with it. A Sprint round is minutes of joining pairs, so without this the
       * graph grows one pair of nodes per wire for the whole round - which is not a leak anybody
       * would see in a demo and is audible as crackle on a phone by the end of a long round.
       */
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          /* Already torn down by a context that closed under us. */
        }
      };
    } catch {
      /* A refused or exhausted audio context must never interrupt the game. */
    }
  }

  return {
    /** Whether sound is on. Read by `app.js` only to label the control. */
    isEnabled() {
      return enabled;
    },

    /**
     * Turn sound on or off and remember it.
     *
     * Unlocking on the way ON matters: the control is the second gesture a player might make, and
     * somebody who starts a round muted and unmutes mid-board would otherwise have a context
     * that was never created from a gesture and stays silent for the rest of the round.
     */
    setEnabled(next) {
      enabled = next === true;
      writePreference(enabled);
      if (enabled) unlock();
    },

    unlock,

    /** One of the fixed sounds by name. An unknown name is silence - see `toneRecipe`. */
    play(name) {
      playRecipe(toneRecipe(name));
    },

    /** The note belonging to a pair, played as its wire lands. */
    playPair(pairId) {
      playRecipe(pairNoteRecipe(pairId));
    },

    /** The board-complete flourish. Its notes carry their own offsets; see `boardCompleteNotes`. */
    playBoardComplete() {
      for (const note of boardCompleteNotes()) playRecipe(note);
    },
  };
}
