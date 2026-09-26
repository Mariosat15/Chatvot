# Play-surface asset map (Improve-game)

**Served set is top-level only.** `readServableAssets` lists files in this directory, not
subfolders — so digits, skins and audio all live here with stable ASCII names.

`.md` is not in `CONTENT_TYPES`, so this file is never served to players.

**Owner 25 Sep 2026:** Phase B menu chrome (`ui-submit` / `ui-clear` / `ui-timer`) was **reverted
and removed**. Continue with music, boards, and digit numbers only.

| File | Role | Wired in |
|---|---|---|
| `digit-0.webp` … `digit-9.webp` | Countdown digit sprites | **C** — `paintClockDigits` in `app.js` |
| `board-4.webp` / `board-6.webp` / `board-8.webp` | Drawn board heroes (Small-1 / Medium-1 / Large-1) | **D** — overwritten in place; CSS neon pulse on `.board-stage.drawn .board-art` |
| `board-skin-4/6/8.webp` | Pack source copies of the same heroes | On disk only (same bytes as board-*); not referenced by code |
| `music-neon-circuit.ogg` | Default bed | **E** — `sound.startMusic()` after Start / first grid touch |
| `sfx-dot-select.ogg` | Terminal / UI press | **E** — `press` |
| `sfx-dot-connected.ogg` | Valid pair join | **E** — `playPair` |
| `sfx-chain-extended.ogg` | Packed; not mapped (no distinct chain event yet) | Available |
| `sfx-connection-invalid.ogg` | Illegal drag | **E** — `refused` |
| `sfx-connection-break.ogg` | Undo | **E** — `break` |
| `sfx-clear-reset.ogg` | Clear | **E** — `clear` |
| `sfx-submit-move.ogg` | Submit press | **E** — `submit` |
| `sfx-countdown-tick.ogg` | Urgent-second tick | **E** — `tick` |
| `sfx-countdown-final.ogg` | Last 3 seconds | **E** — `tick-final` |
| `sfx-timer-warning.ogg` | Once when ≤10s begins | **E** — `warning` |
| `sfx-time-up.ogg` | Clock hits zero | **E** — `time-up` |
| `sfx-new-board.ogg` | Start / next board | **E** — `start` |
| `sfx-board-complete.ogg` | Board solved (server-confirmed) | **E** — `playBoardComplete` |
| `sfx-win.ogg` | Triumphant result | **E** — `win` |
| `sfx-combo-bonus.ogg` | Packed only — **never** mapped (no fake score multiplier) | Not wired |

Existing tokens (`token-1..10.webp`) and `board-frame.webp` unchanged.
`numbers animations/` in the owner pack was empty / unlabelled — skipped (Phase G later if filled).

---

## Phase I — Feedback & polish graphics (26 Sep 2026) — **WIRED**

Created for the ten gameplay/graphics improvements, then wired into `board.js` / `app.js` /
`app.css` / `index.html`, with arena hierarchy in `NEON_STAGE_FRAME` + `NEON_PANEL_SIDE`.
Still **no** Phase B menu faces (Submit/Clear stay text).

| File | Role | Wired in |
|---|---|---|
| `fx-lock-on*.webp` | Soft pulse on first terminal tap | **I** — `showLockOn` in `board.js` |
| `fx-invalid-flash.webp` | ~~Red HUD flash~~ | **REMOVED from UI 26 Sep** — assets on disk only; refuse = token shake + SFX |
| `fx-complete-burst.webp` / `fx-board-flash.webp` | ~~Local complete burst~~ | **Burst removed 26 Sep**; `fx-board-flash` may still dress sealed/solved CSS |
| `fx-submit-ready.svg` | ~~Cyan ready rim~~ | **Unused 26 Sep** — Submit uses outer glow only (no inset / SVG rim) |
| `fx-clear-secondary.svg` | ~~Muted secondary rim~~ | **Unused 26 Sep** — Clear matches Undo ghost chrome |
| `fx-timer-urgent-rim.svg` | Soft red clock rim ≤10s | **I** — `.readout-clock.urgent-rim` + half-second ticks |
| `wire-pattern-0..9.svg` | Colour-blind cue references | **I** — live cue is `stroke-dasharray` via `WIRE_DASH` (same 10 patterns) |
| `fx-cell-contrast.svg` | Dense-grid cell lift (reference) | **I** — CSS `.layer-cells.dense` contrast |
| `intro-howto-clean.webp` | ~~Teach diagram on Start~~ | **Removed 26 Sep** — intro is rules panels only (no scroll / no error-X art) |
| `fx-stage-glow.svg` | Stage hierarchy reference | **I** — brighter `NEON_STAGE_FRAME`, quieter `NEON_PANEL_SIDE` |
| `fx-circuit-sealed.webp` | Freeze/glow before result | **I** — `sealCircuitBeat()` on round end |

**Sources:** owner `improved/Effects/` (sliced), `bardi complete*.png`, plus generated overlays.
SVG rims/patterns are hand-authored. Keep Phase B rule: no Submit/Clear/Timer *menu faces*.

---

## Phase J — Arcade motion FX (26 Sep 2026) — **WIRED (light)**

Six effects live as **cheap SVG/CSS**, not the heavy WebP washes (owner: board felt heavy).
Raster Phase J files remain on disk as optional art; live code does not warm them.

| Effect | Live implementation |
|---|---|
| Wire trail | `.fx-trail-tip` circle follows drag cell |
| Undo rewind | `.fx-undo-rewind` ghost polyline on Undo |
| Board-enter charge | `.fx-board-wake` rings on terminals in `setPuzzle` |
| Result power-up | Existing `countUpStat` + `#screen-result.result-power` corona |
| Coverage ripple | `.fx-cell-ripple` when a pip is removed |
| Pair join spark | `.fx-join-spark` beads terminal → midpoint (on top of join pulse) |

Also same day: hide scrollbars; Clear = Undo chrome; strip invalid tip / complete burst /
Submit inset rim; drop board `drop-shadow` + neon pulse for perf.

**Conversion:** `games-service/tools/keyout-phase-j.cjs` (black plate → alpha WebP).
Raster assets kept for a later richer pass if wanted.
