/**
 * Circuit - the sounds, and nothing else.
 *
 * WHAT IS HERE AND WHAT IS IN `presentation.js`
 * --------------------------------------------
 * Every number about a *synthesised* sound - its pitch, its shape, how long it lasts, how loud it
 * is, which note a pair gets - is in `presentation.js`, where a test can read it without a
 * browser. This file holds the Web Audio calls and, since Improve-game Phase E, the OGG sample
 * playback. The synthesised recipes stay as the fallback when a file fails to load.
 *
 * THREE RULES THIS FILE EXISTS TO KEEP, IN ORDER OF HOW BADLY EACH ONE FAILS
 * ------------------------------------------------------------------------
 * 1. NOTHING HERE IS EVER AWAITED. There is no `async` and no `await` in this file, and every
 *    entry point returns `undefined`, so there is nothing on the gameplay path a caller could
 *    wait for even by accident. `AudioContext.resume()`, `fetch`, and `decodeAudioData` all return
 *    promises and are started-and-forgotten - putting any of them between a tap and the POST that
 *    starts the clock would make the player's score pay for audio hardware.
 *
 * 2. A BROKEN AUDIO STACK IS A SILENT GAME, NEVER A BROKEN ONE. Every call is inside a try/catch
 *    and the first hard failure sets `broken`, after which this object does nothing at all. A
 *    missing OGG falls back to the synthesised recipe for that name; only a dead AudioContext
 *    silences everything.
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

/** A 6ms fade in and out of every synthesised note. See `playRecipe` - without it each one is a click. */
const EDGE_S = 0.006;

/**
 * Packed OGG files → logical sound names used by `app.js`.
 *
 * `sfx-combo-bonus` is deliberately NOT mapped: it must not imply a scoring bonus the server does
 * not award (Improve-game constraint). Synthesised `toneRecipe` covers any name without a sample.
 */
const SAMPLE_URLS = new Map([
  ["press", "/play/sfx-dot-select.ogg"],
  ["start", "/play/sfx-new-board.ogg"],
  ["refused", "/play/sfx-connection-invalid.ogg"],
  ["clear", "/play/sfx-clear-reset.ogg"],
  ["break", "/play/sfx-connection-break.ogg"],
  ["tick", "/play/sfx-countdown-tick.ogg"],
  ["tick-final", "/play/sfx-countdown-final.ogg"],
  ["warning", "/play/sfx-timer-warning.ogg"],
  ["time-up", "/play/sfx-time-up.ogg"],
  ["submit", "/play/sfx-submit-move.ogg"],
  ["connected", "/play/sfx-dot-connected.ogg"],
  // Feel-only: second+ join in a row on the same board. Never implies a score multiplier.
  ["chain", "/play/sfx-chain-extended.ogg"],
  ["board-complete", "/play/sfx-board-complete.ogg"],
  ["win", "/play/sfx-win.ogg"],
  ["music", "/play/music-neon-circuit.ogg"],
]);

/** Relative gains under the music bed (SFX_MAP recommendation: SFX ~25–40%, complete/win higher). */
const SAMPLE_GAIN = new Map([
  ["press", 0.32],
  ["start", 0.38],
  ["refused", 0.48],
  ["clear", 0.34],
  ["break", 0.32],
  ["tick", 0.28],
  ["tick-final", 0.4],
  ["warning", 0.42],
  ["time-up", 0.5],
  ["submit", 0.36],
  ["connected", 0.34],
  ["chain", 0.38],
  ["board-complete", 0.62],
  ["win", 0.68],
  // Reason: at 0.22 x the 0.7 default slider the loop played at ~15% and was reported as
  // inaudible under the effects (25 Sep 2026). The slider still scales it down from here.
  ["music", 0.55],
]);

/**
 * Every sample URL the page may need, for `app.js` to warm while the player reads the rules.
 * Music is included: a 2.5 MB fetch during intro is better than paying for it after Start.
 */
export const SAMPLE_ART = [...SAMPLE_URLS.values()];

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
  /** @type {Map<string, AudioBuffer>} */
  const buffers = new Map();
  /** @type {Set<string>} */
  const loading = new Set();
  let musicSource = null;
  let musicGain = null;
  let musicWanted = false;
  /** 0–1. Music and effects are separate so muting one does not silence the other. */
  let musicLevel = 0.85;
  let sfxLevel = 0.8;
  let musicMuted = false;
  let sfxMuted = false;

  function clampLevel(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(1, Math.max(0, number));
  }

  function applyMusicLevel() {
    if (!musicGain || !context) return;
    const level = musicMuted ? 0 : (SAMPLE_GAIN.get("music") || 0.55) * musicLevel;
    try {
      musicGain.gain.setValueAtTime(level, context.currentTime);
    } catch {
      /* A closed context must not throw into the drag handler. */
    }
  }

  function resume() {
    if (!context || context.state !== "suspended") return;
    try {
      const pending = context.resume();
      if (pending && typeof pending.catch === "function") pending.catch(() => {});
    } catch {
      broken = true;
    }
  }

  /**
   * Bring the bed back after the browser paused audio.
   *
   * WHY THIS EXISTS (owner, 25 Sep 2026: music gone after pause/unpause). Browsers suspend an
   * AudioContext when the tab is hidden, the phone locks, or the iframe loses focus - and a
   * BufferSource that was playing under a suspended context is often dead when the context
   * resumes. Calling `resume()` alone leaves silence with `musicWanted` still true. Restarting
   * the source is the only reliable recovery; it must never await on the gameplay path.
   *
   * ONLY CALL THIS when the player actually left (tab hidden / bfcache). Never from `unlock` or
   * `focus` during a drag — those fire on every board touch and were restarting the bed from
   * zero under every SFX (owner, 26 Sep 2026).
   */
  function reviveMusic() {
    if (!enabled || broken || !musicWanted || musicMuted) return;
    resume();
    stopMusicInternal();
    startMusicInternal();
  }

  /**
   * Keep a wanted bed alive without rewinding it. Resumes a suspended context; starts only when
   * there is no live `musicSource`. Safe on every pointerdown / focus / SFX path.
   */
  function ensureMusic() {
    if (!enabled || broken || !musicWanted || musicMuted) return;
    resume();
    if (!musicSource) startMusicInternal();
  }

  function loadSample(name, url) {
    if (!context || broken || buffers.has(name) || loading.has(name)) return;
    loading.add(name);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.arrayBuffer();
      })
      .then((bytes) => {
        if (!context) return null;
        // Older WebKit still wants a callback form; the promise form is preferred where it exists.
        return context.decodeAudioData(bytes.slice(0));
      })
      .then((buffer) => {
        if (buffer) buffers.set(name, buffer);
        loading.delete(name);
        if (name === "music" && musicWanted) startMusicInternal();
      })
      .catch(() => {
        loading.delete(name);
        /* Missing or undecodable file → synthesised fallback on play. */
      });
  }

  function warmAllSamples() {
    if (!context || broken) return;
    for (const [name, url] of SAMPLE_URLS) loadSample(name, url);
  }

  function unlock() {
    if (broken) return;
    if (!context) {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) {
          broken = true;
          return;
        }
        context = new Ctor();
      } catch {
        broken = true;
        context = null;
        return;
      }
    }
    // Reason: unlock runs on Start and on every board pointerdown (gesture unlock for SFX).
    // Restarting the bed here made music rewind under every connect — ensure, never revive.
    resume();
    ensureMusic();
    warmAllSamples();
  }

  function playRecipe(recipe) {
    if (!enabled || sfxMuted || sfxLevel <= 0 || broken || !context || !recipe) return;
    try {
      const seconds = Math.max(0.02, recipe.ms / 1000);
      const at = context.currentTime + Math.max(0, (recipe.delayMs || 0) / 1000);
      const ends = at + seconds;

      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = recipe.type;
      osc.frequency.setValueAtTime(recipe.fromHz, at);
      if (recipe.toHz !== recipe.fromHz) {
        osc.frequency.exponentialRampToValueAtTime(recipe.toHz, ends);
      }

      gain.gain.setValueAtTime(0, at);
      const heard = recipe.gain * sfxLevel;
      gain.gain.linearRampToValueAtTime(heard, at + EDGE_S);
      gain.gain.setValueAtTime(heard, Math.max(at + EDGE_S, ends - EDGE_S));
      gain.gain.exponentialRampToValueAtTime(0.0001, ends);

      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(at);
      osc.stop(ends + EDGE_S);

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

  function playBuffer(name, opts) {
    if (!enabled || broken || !context) return false;
    if (name !== "music" && (sfxMuted || sfxLevel <= 0)) return false;
    if (name === "music" && musicMuted) return false;
    const buffer = buffers.get(name);
    if (!buffer) return false;
    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      const base = (opts && opts.gain) || SAMPLE_GAIN.get(name) || 0.35;
      const level = base * (name === "music" ? musicLevel : sfxLevel);
      source.buffer = buffer;
      source.loop = Boolean(opts && opts.loop);
      gain.gain.setValueAtTime(level, context.currentTime);
      source.connect(gain);
      gain.connect(context.destination);
      source.start(context.currentTime + Math.max(0, ((opts && opts.delayMs) || 0) / 1000));
      if (!source.loop) {
        source.onended = () => {
          try {
            source.disconnect();
            gain.disconnect();
          } catch {
            /* already gone */
          }
        };
      }
      if (opts && opts.loop) {
        musicSource = source;
        musicGain = gain;
      }
      return true;
    } catch {
      return false;
    }
  }

  function playNamed(name) {
    if (playBuffer(name)) return;
    const url = SAMPLE_URLS.get(name);
    if (url) loadSample(name, url);
    playRecipe(toneRecipe(name));
  }

  function stopMusicInternal() {
    if (musicSource) {
      try {
        musicSource.stop();
      } catch {
        /* already stopped */
      }
      try {
        musicSource.disconnect();
        if (musicGain) musicGain.disconnect();
      } catch {
        /* already gone */
      }
    }
    musicSource = null;
    musicGain = null;
  }

  function startMusicInternal() {
    if (!enabled || broken || !context || !musicWanted || musicMuted) return;
    if (musicSource) return;

    const go = () => {
      if (musicSource || !musicWanted || musicMuted) return;
      if (!playBuffer("music", { loop: true, gain: SAMPLE_GAIN.get("music") })) {
        loadSample("music", SAMPLE_URLS.get("music"));
      }
    };

    // Reason: playBuffer against a still-suspended context is a silent no-op on several
    // browsers. Resume first, then start - and never await this from a drag handler.
    if (context.state === "suspended") {
      try {
        const pending = context.resume();
        if (pending && typeof pending.then === "function") {
          pending.then(go).catch(() => {});
          return;
        }
      } catch {
        broken = true;
        return;
      }
    }
    go();
  }

  // Tab was hidden: BufferSource is often dead after resume — full revive once.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) reviveMusic();
    });
  }
  if (typeof window !== "undefined") {
    // Focus fires when clicking the iframe mid-drag — ensure only, never rewind.
    window.addEventListener("focus", ensureMusic);
    // bfcache restore can leave a dead source; revive is correct here.
    window.addEventListener("pageshow", (event) => {
      if (event && event.persisted) reviveMusic();
      else ensureMusic();
    });
  }

  return {
    isEnabled() {
      return enabled;
    },

    setEnabled(next) {
      enabled = next === true;
      writePreference(enabled);
      if (enabled) {
        unlock();
        if (musicWanted) startMusicInternal();
      } else {
        stopMusicInternal();
      }
    },

    musicLevel() {
      return musicLevel;
    },

    sfxLevel() {
      return sfxLevel;
    },

    isMusicMuted() {
      return musicMuted;
    },

    isSfxMuted() {
      return sfxMuted;
    },

    setMusicLevel(value) {
      musicLevel = clampLevel(value);
      applyMusicLevel();
    },

    setSfxLevel(value) {
      sfxLevel = clampLevel(value);
    },

    setMusicMuted(next) {
      musicMuted = next === true;
      if (musicMuted) stopMusicInternal();
      else if (musicWanted) startMusicInternal();
    },

    setSfxMuted(next) {
      sfxMuted = next === true;
    },

    unlock,

    /** One of the fixed sounds by name. Sample first, synthesised fallback. */
    play(name) {
      playNamed(name);
    },

    /** The note belonging to a pair, played as its wire lands. */
    playPair(pairId) {
      if (playBuffer("connected")) return;
      loadSample("connected", SAMPLE_URLS.get("connected"));
      playRecipe(pairNoteRecipe(pairId));
    },

    /**
     * Second+ consecutive join on the same board (feel only). Falls back to the pair note so a
     * missing sample never leaves a silent join.
     */
    playChain(pairId) {
      if (playBuffer("chain")) return;
      loadSample("chain", SAMPLE_URLS.get("chain"));
      if (playBuffer("connected")) return;
      loadSample("connected", SAMPLE_URLS.get("connected"));
      playRecipe(pairNoteRecipe(pairId));
    },

    /** Board solved (server-confirmed). Sample first; arpeggio fallback. */
    playBoardComplete() {
      if (playBuffer("board-complete")) return;
      loadSample("board-complete", SAMPLE_URLS.get("board-complete"));
      for (const note of boardCompleteNotes()) playRecipe(note);
    },

    /** Start the looping bed after Start. Safe to call repeatedly — never rewinds a live bed. */
    startMusic() {
      musicWanted = true;
      unlock();
      ensureMusic();
    },

    /** Stop the bed (leave / result / mute). */
    stopMusic() {
      musicWanted = false;
      stopMusicInternal();
    },
  };
}
