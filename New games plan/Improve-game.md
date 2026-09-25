# Improve Circuit — play-surface art, digits & audio

**Status:** Phase A packed. Phase B chrome **REVERTED** (owner 25 Sep 2026 — disliked Submit/Clear/Timer art). Phases **C + D + E wired** (digits, board skins + pulse, music/SFX). Menu chrome skipped.  
**Lives in:** `games-service/public/play/` only — platform repo stays out of the board (isolation / `check:isolation`).  
**Source pack (owner machine, not in git yet):** `c:\Users\cybes\Desktop\games\boardgame\improved\`  
**Map:** `games-service/public/play/ASSET-MAP.md`

This chapter is the working brief for upgrading the **in-frame** Circuit UI after s4.1q/r/s. It does **not** change scoring, ranking, attempts, or the provider protocol. A wrong-looking chrome is a presentation defect; inventing a mid-round SCORE or a Hint is a fairness / protocol defect and stays forbidden (`13` s4.1q, marketplace rule).

---

## 1. What exists today (must not break)

| Piece | Live code | Notes |
|---|---|---|
| Board + terminals | `board.js`, `board-4/6/8.webp`, `token-1..10.webp`, `board-frame.webp` | Heroes replaced in place from Small/Medium/large; CSS neon pulse on drawn boards; tokens 9–10 added 25 Sep so large can use up to 10 pairs |
| Chrome / copy | `index.html`, `app.css`, `presentation.js` | Pre-Phase-B text buttons restored; **no** `ui-*.webp` |
| Clock | `paintClockDigits` + `digit-0..9.webp` | Sprites are paint; time still from `endsAt` |
| Sound | `sound.js` sample-then-synth + music bed | OGG map in `SAMPLE_URLS`; mute stops music; **revive on visibility/focus/unlock** after browser pause (25 Sep) |
| Drag feel | `board.js` paint + `app.css` pulse | **25 Sep:** wires/pips update in place (no full layer clear), CTM cached, paints coalesced to rAF; board glow animates opacity only (not `filter`) |
| Deploy | directory-derived serve + content fingerprint (`21` s4.1i / s4.1o) | New `.js` / new filenames need pull + **`pm2 restart chartvolt-games`**; `.ts` still needs `npm run build` |

Acceptance after this work stays the same as s4.1e: a human can start, play, submit, and finish a paid round by clicking. Visual / audio sign-off is **owner eye/ear**.

---

## 2. Asset inventory (owner pack)

### 2.1 Named chrome (root of `improved/`) — **SKIPPED**

Submit / Clear / Timer / Progress / semi / bardi overlays: **not wired**. Owner rejected Phase B chrome; leave those PNGs in the pack for a later pass if wanted.

### 2.2 Board art by size — **WIRED (D)**

| Folder | Hero used | Live file |
|---|---|---|
| `Small/` | `Small-1` | `board-4.webp` (+ `board-skin-4.webp` copy) |
| `Medium/` | `Medium-1` | `board-6.webp` (+ `board-skin-6.webp`) |
| `large/` | `Large-1` | `board-8.webp` (+ `board-skin-8.webp`) |

Decision unchanged: folders are **variant skins**, not animation frames. Ship one hero per size + **CSS pulse**. Do not cycle Small-1→Small-2 as a film strip.

### 2.3 Number animations — **SKIPPED for now**

`numbers animations/` had no usable labelled frames on inventory. Countdown uses static `digit-0..9.webp` from the pack root (`Time0`…`Time9`). Phase G if the folder is filled later.

### 2.4 Music & SFX — **WIRED (E)**

| File | Use |
|---|---|
| `music-neon-circuit.ogg` | Default bed after Start (or first grid touch on resume) |
| Mapped `sfx-*.ogg` | See `ASSET-MAP.md` / `SAMPLE_URLS` in `sound.js` |
| `sfx-combo-bonus.ogg` | **Not mapped** — must not imply a scoring bonus |

---

## 3. Hard constraints (do not “finish off”)

1. **No Hint** — marketplace fairness; still probed beside `undoState`.
2. **No mid-round SCORE / rank / prize in the frame** — `PlayState` has none; `resultCopy` is pinned to refuse leaking them.
3. **Submit is server-gated** — chrome may look “ready”; only `verify` decides.
4. **Terminal numeral stays under art** — if a PNG 404s, the board remains playable (s4.1m lesson).
5. **Audio never blocks gameplay** — no `await` on the play path (`sound.js` rule 1). Broken audio stack = silent game, not a dead one.
6. **Isolation** — assets and any new modules stay under `games-service/`; no `paths` mapping into the platform.
7. **Fingerprint / cache** — ship WebP under `/play/…`; avoid bare filename overwrite that Cloudflare caches for hours (R54 / R55).
8. **Clear ≠ Submit** — Clear stays secondary; Submit stays the wide primary (s4.1r).

---

## 4. Target UX (what the player should see)

1. **Intro** — existing rules + Start; unlock audio on that gesture; start music only after Start.
2. **Play** — new board bezels; digit sprites on the clock; soft neon pulse; text Submit / Clear / Undo (no menu art).
3. **Feedback** — SFX for select / connect / invalid / clear / undo / submit; board-complete sample; win on triumphant result.
4. **Result** — existing panel; music stops.

---

## 5. Build phases

### Phase A — Pack hygiene — **BUILT 25 Sep 2026**

### Phase B — Chrome swap — **REVERTED 25 Sep 2026**

Owner disliked Submit / Clear / Timer artwork. Files `ui-*.webp` deleted; markup/CSS restored to pre-B text controls. **Do not reintroduce without a new owner pass.**

### Phase C — Digit clock — **BUILT 25 Sep 2026**

- `CLOCK_DIGIT_ART` + `paintClockDigits` in `app.js`.
- Warning once at ≤10s; `tick` / `tick-final` / `time-up` SFX.

### Phase D — Board skins — **BUILT 25 Sep 2026**

- Heroes overwritten onto `board-4/6/8.webp`; CSS `board-neon-pulse` under `prefers-reduced-motion: no`.

### Phase E — Real audio — **BUILT 25 Sep 2026**

- `sound.js` OGG buffers + music loop; synth fallback via expanded `toneRecipe` names.

### Phase F — Complete overlay — **not started** (menu / bardi skipped with chrome)

### Phase G — Number animation polish — **deferred** (folder empty / unlabelled)

### Phase H — Docs, tests, deploy

- Update this file + `ASSET-MAP.md` (done with C/D/E).
- `External game plans/21` BUILT block when owner signs off the full slice.
- Deploy: `git pull` + `pm2 restart chartvolt-games` (and `npm run build` if `.ts` changed).

---

## 6. Effort (remaining)

| Slice | Status |
|---|---|
| A Pack hygiene | **done** |
| B Chrome (Submit/Clear/Timer) | **reverted — skip** |
| C Digits + timer SFX | **done** |
| D Board skins + pulse | **done** |
| E Audio files | **done** |
| F Complete overlay | deferred with menu skip |
| G Number anim | deferred |
| H Owner eye/ear + deploy | **next** |

---

## 7. Decisions on record

**Closed 25 Sep 2026**

1. Board folders → one hero per size + CSS pulse (not PNG loops).
2. Music default → `music-neon-circuit.ogg`.
3. Phase D heroes → `Small-1` / `Medium-1` / `Large-1`.
4. **Skip menu chrome** (Submit / Clear / Timer / Progress art) after owner rejection of Phase B.

**Still open**

5. Complete modal / bardi overlay — later if wanted.
6. `numbers animations/` if the pack gains labelled frames.

**Arena shell (25 Sep, same day)** — stretch standings + stage to fill the prize-column height (`items-stretch`, drop viewport max-h on the rail); raise tips band to `sm:h-[300px]` so How it works / Game tips are not mid-sentence clipped. Platform files: `GameArenaLayout.tsx`.

**Band clipping, second pass (25 Sep)** — the 300px band did not cure it: the real cause was the `shape="fill"` picture being an in-flow `h-full` image in a slot with no definite height, so it took its natural height, grew the card past the band and `overflow-hidden` cut the bottom border. The picture is now `absolute inset-0` inside a `relative` sized slot (40% rules / 36% tips), so it can never add height; rules steps wrap to two lines (`line-clamp-2`, test flipped) instead of cutting mid-sentence. Files: `components/neon/Cards.tsx`, `GameRulesPanel.tsx`, `ArenaHighlights.tsx`. Not verified by eye.

---

## 8. Next

Owner eye/ear on digits, board skins + pulse, and music/SFX on a real play session. Then deploy restart of `chartvolt-games`.

---

## 9. Explicitly out of scope

- Platform arena chrome (`components/games/arena/*`).
- Hint, invented SCORE, Combo as a scored metric, XP LEVEL bar.
- Protocol / callback / settlement changes.
- Re-adding Phase B menu chrome without a new owner request.
