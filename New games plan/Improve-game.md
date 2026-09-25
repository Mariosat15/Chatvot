# Improve Circuit — play-surface art, digits & audio

**Status:** Phase A + B BUILT (25 Sep 2026). Stop for owner eye-check before C/D/E/F.  
**Lives in:** `games-service/public/play/` only — platform repo stays out of the board (isolation / `check:isolation`).  
**Source pack (owner machine, not in git yet):** `c:\Users\cybes\Desktop\games\boardgame\improved\`  
**Map:** `games-service/public/play/ASSET-MAP.md`  
**Reference captures also landed in Cursor assets** (same session) for wording that the filenames do not carry.

This chapter is the working brief for upgrading the **in-frame** Circuit UI after s4.1q/r/s. It does **not** change scoring, ranking, attempts, or the provider protocol. A wrong-looking chrome is a presentation defect; inventing a mid-round SCORE or a Hint is a fairness / protocol defect and stays forbidden (`13` s4.1q, marketplace rule).

---

## 1. What exists today (must not break)

| Piece | Live code | Notes |
|---|---|---|
| Board + terminals | `board.js`, `board-4/6/8.webp`, `token-1..8.webp`, `board-frame.webp` | Artwork is decoration; **vector socket + numeral always drawn underneath**. Skins packed as `board-skin-4/6/8.webp` (Phase D not wired) |
| Chrome / copy | `index.html`, `app.css`, `presentation.js` | **Phase B:** Submit / Clear / Timer use `ui-*.webp`. Undo unchanged. No Hint. No header SCORE |
| Sound | `sound.js` + `toneRecipe` in `presentation.js` | Still synthesised until Phase E; OGG files are on disk and **served** (`.ogg` in `CONTENT_TYPES`) but not played yet |
| Deploy | directory-derived serve + content fingerprint (`21` s4.1i / s4.1o) | New `.js` / new filenames need pull + **`pm2 restart chartvolt-games`**; `.ts` still needs `npm run build` |

Acceptance after this work stays the same as s4.1e: a human can start, play, submit, and finish a paid round by clicking. Visual / audio sign-off is **owner eye/ear** — automated browser has no session on the arena.

---

## 2. Asset inventory (owner pack)

### 2.1 Named chrome (root of `improved/`)

| File(s) | Role on the play surface | Maps to |
|---|---|---|
| `submit.png` | Primary **SUBMIT** control (green neon frame) | `#submit` / `.submit-wide` → **`ui-submit.webp` (B)** |
| `clear.png` | **Clear** control (red neon, refresh icon + label) | `#clear` → **`ui-clear.webp` (B)**; CSS max-width keeps secondary |
| `Timer.png` | **TIME LEFT** panel shell (stopwatch + label; digits sit below) | `.chrome-timer` → **`ui-timer.webp` (B)**; digits still text until C |
| `Time0.png` … `Time9.png` | Neon digit sprites for the countdown | **`digit-0..9.webp` packed**; Phase C paints them |
| `Progress.png` | **PROGRESS / Solved** banner (trophy rings) | “boards solved” / progress strip |
| `semi.png` | Empty neon tile frames (×2 stacked in source) | Stat tile shells (`playStatTiles`) |
| `13.png` | **COMPLETED!** ribbon (green check) | Board-complete toast / strip |
| `14.png` / `15.png` / `16.png` | Home / Try Again / Play (framed icons + Try Again banner) | Result-panel actions (practice / leave — **not** a second scoring door) |
| `21.png` / `22.png` | Horizontal / vertical neon “bone” rails | Decorative connectors / meter ends |
| `bardi complete*.png` + `bardi completeExample Look.png` | **BOARD / LEVEL COMPLETE** modal (crown, stars, Home / Restart / Next) | End-of-board or end-of-round overlay |
| `1.png`…`12.png`, `ChatGPT Image…`, UUID-named PNGs | Unlabelled pack members — **triage before use** (likely alt boards, bezels, or drafts) | Do not ship until named |

### 2.2 Board art by size

| Folder | Files | Use |
|---|---|---|
| `Small/` | `Small-1.png` … `Small-18.png` | Art for the **small** grid — hero packed as **`board-skin-4.webp`** |
| `Medium/` | `Medium-1.png` … `Medium-12.png` | Art for the **medium** grid — **`board-skin-6.webp`** |
| `large/` | `Large-1.png` … `Large-15.png` | Art for the **large** grid — **`board-skin-8.webp`** |

**Decision (25 Sep 2026):** these folders are **variant skins**, not animation frames of one board.
Checked `Small-1` / `Small-2` / `Small-9` and `Medium-1` / `Medium-2`: different frames, metals, and neon colours (e.g. blue vs red Medium), same grid size. Cycling them as a “film strip” would look like the board teleporting between designs, not breathing.

**What we can animate (and will):**

| Approach | How | Cost / risk |
|---|---|---|
| **A. Default — one static hero per size + CSS pulse** | Ship the best WebP per size; pulse opacity / filter on neon edges under `prefers-reduced-motion: no` | Cheap, no extra downloads after Start |
| **B. Optional skin crossfade** | Preload 2–3 skins **before** Start, then slow crossfade | Heavier; must finish warming before the clock starts (clock = score) |
| **C. Not these PNGs as sprite loops** | True frame animation needs sequential frames of the *same* board | Pack does not provide that |

Ship **A** in Phase D. **B** only if owner wants after seeing A. Never download board art after Start.

### 2.3 Number animations

`numbers animations/` — ~40 ChatGPT-dated PNGs. Treat as **animated digit / pop sequences** for:

- countdown second changes,
- optional “boards solved” tick,

—not as a second scoring authority. Prefer a short sprite sheet or ordered frames named `digit-{0-9}-f{n}.webp` after triage.

### 2.4 Music & SFX (`Music & SFX/`)

**Loops (OGG, ~2 min, designed to loop):**

| File | Use |
|---|---|
| **`neon_circuit_board_game_loop_2min.ogg`** | **DEFAULT bed** — packed as **`music-neon-circuit.ogg`** |
| `01_circuit_candy_run_2min_loop.ogg` | Kept as alternate (brighter / candy) for a later skin switch |
| Other `*_2min_loop.ogg` | Alternates only — not loaded by default |

**SFX (from `SFX_MAP.txt` — authoritative event names):** packed as `sfx-*.ogg` (see `ASSET-MAP.md`). Volumes: SFX ~25–40% under music; board-complete / win ~55–70%. Do **not** map `sfx-combo-bonus` to a fake score multiplier.

`Effects/` — empty on inventory day; ignore until filled.

---

## 3. Hard constraints (do not “finish off”)

1. **No Hint** — marketplace fairness; still probed beside `undoState`.
2. **No mid-round SCORE / rank / prize in the frame** — `PlayState` has none; `resultCopy` is pinned to refuse leaking them.
3. **Submit is server-gated** — chrome may look “ready”; only `verify` decides.
4. **Terminal numeral stays under art** — if a PNG 404s, the board remains playable (s4.1m lesson).
5. **Audio never blocks gameplay** — no `await` on the play path (`sound.js` rule 1). Broken audio stack = silent game, not a dead one.
6. **Isolation** — assets and any new modules stay under `games-service/`; no `paths` mapping into the platform.
7. **Fingerprint / cache** — ship WebP under `/play/…`; avoid bare filename overwrite that Cloudflare caches for hours (R54 / R55).
8. **Clear ≠ Submit** — Clear stays secondary; Submit stays the wide primary (s4.1r). **Phase B:** Clear capped at `max-width: 7.25rem`; Submit `flex: 1`.

---

## 4. Target UX (what the player should see)

1. **Intro** — existing rules + Start; unlock audio on that gesture; start music only after Start if a bed is enabled.
2. **Play** — new board bezel / size art; Timer shell + digit sprites; Progress banner for boards solved; semi tiles for Moves / Best / coverage meter; green Submit + red Clear artwork; Undo unchanged functionally.
3. **Feedback** — SFX for select / connect / invalid / clear / submit; soft board-complete ribbon; optional short digit pop on second change.
4. **Round / board complete** — `bardi` style overlay; stars as flavour unless a server-backed rule exists.
5. **Result** — Home / Try Again / Next only where today’s result panel already offers leave / replay semantics; never a path that spends another attempt without going through launch.

---

## 5. Build phases

### Phase A — Pack hygiene — **BUILT 25 Sep 2026**

- Copied chosen assets into `games-service/public/play/` with **stable ASCII top-level names** (not `ui/` / `audio/` subfolders — `readServableAssets` only lists top-level files).
- Converted chrome + board heroes + digits → WebP; copied default music + all 15 SFX as OGG.
- Wrote `ASSET-MAP.md` in that folder.
- Unnamed root PNGs left in the owner pack (not shipped).
- Added `.ogg` to `CONTENT_TYPES` in `play-page.ts`.

### Phase B — Chrome swap — **BUILT 25 Sep 2026 (Submit / Clear / Timer only)**

- Markup + CSS: Submit, Clear, Timer shell as `<img>` / background.
- Hit targets ≥ today; disabled Submit dims the face; `setSubmitLabel` avoids wiping the `<img>` via `textContent`.
- Clear secondary width preserved (`max-width: 7.25rem`).
- Progress / semi tiles deferred (next chrome pass after eye-check).
- **Stop for owner eye-check before C/D/E/F.**

### Phase C — Digit clock (0.5–1 day)

- Render remaining time with `digit-0..9.webp`.
- Still driven by `playableSeconds` / server-anchored clock — **sprites are paint, not a second clock**.
- Wire countdown SFX per map rules.

### Phase D — Board skins (1–2 days)

- Wire `board-skin-4/6/8.webp` (already packed from Small-1 / Medium-1 / Large-1).
- Re-measure `BOARD_ART_OVERHANG` if bezels change; keep width-bound cell math (s4.1r).
- Warm new URLs in `BOARD_ART`.

### Phase E — Real audio (1–2 days)

- Extend `sound.js` to play OGG buffers **without** awaiting on the gameplay path.
- Keep synthesised `toneRecipe` as fallback.
- One default music loop; respect mute.

### Phase F — Complete overlay (1 day)

- BOARD COMPLETE modal from `bardi` assets; match today’s affordances only.

### Phase G — Number animation polish (optional, 0.5–1 day)

### Phase H — Docs, tests, deploy

- Update `External game plans/21` with a BUILT block when the full slice lands — not before eye-check.
- Deploy: `git pull` + `pm2 restart chartvolt-games` (and `npm run build` if `.ts` changed).

---

## 6. Effort (remaining)

| Slice | Days |
|---|---|
| A Pack hygiene | **done** |
| B Chrome (Submit/Clear/Timer) | **done** |
| C Digits + timer SFX | 0.5–1 |
| D Board skins | 1–2 |
| E Audio files | 1–2 |
| F Complete overlay | 1 |
| G Number anim (optional) | 0.5–1 |
| H Docs / probes / deploy | 0.5 |
| **Remaining** | **~4–8 days** (G optional) |

This is presentation work on X4a’s play surface. It does **not** move X4 / X5 / X12.

---

## 7. Decisions on record + remaining questions

**Closed 25 Sep 2026**

1. **Board folders:** skins (one hero per size) + CSS neon pulse. Not PNG frame-loops.
2. **Music default:** `neon_circuit_board_game_loop_2min.ogg` → `music-neon-circuit.ogg`.
3. **Phase D heroes (eng default):** `Small-1` / `Medium-1` / `Large-1` until owner names otherwise.

**Still open**

4. **Complete modal stars:** decoration only, or later a real server-side rule?
5. **Try Again / Restart on a paid attempt:** confirm it must **not** grant a free second attempt.
6. **Unnamed root PNGs:** keep, delete, or move to drafts outside the served set?

---

## 8. Next after eye-check

Owner reviews Submit / Clear / Timer chrome on a real play session. Then Phase C (digit sprites) or D (board skins) as preferred.

---

## 9. Explicitly out of scope

- Platform arena chrome (`components/games/arena/*`) — separate from the iframe.
- Hint, invented SCORE, Combo as a scored metric, XP LEVEL bar.
- Protocol / callback / settlement changes.
- Replacing Greek / EN copy pipelines.
- Hostinger / Cloudflare deploy procedure changes (except games-service restart note above).
