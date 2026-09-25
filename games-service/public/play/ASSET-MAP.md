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

Existing tokens (`token-1..8.webp`) and `board-frame.webp` unchanged.
`numbers animations/` in the owner pack was empty / unlabelled — skipped (Phase G later if filled).
