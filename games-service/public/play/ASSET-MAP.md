# Play-surface asset map (Improve-game Phase A)

**Served set is top-level only.** `readServableAssets` lists files in this directory, not
subfolders — so chrome, digits, skins and audio all live here with stable ASCII names (not under
`ui/` or `audio/` as an early draft of the plan suggested).

`.md` is not in `CONTENT_TYPES`, so this file is never served to players.

| File | Role | Wired in |
|---|---|---|
| `ui-submit.webp` | Submit button face | `#submit .chrome-face` CSS background (Phase B) |
| `ui-clear.webp` | Clear button face | `#clear .chrome-face` CSS background (Phase B; CSS max-width keeps it secondary) |
| `ui-timer.webp` | TIME LEFT shell | `.chrome-timer` background (Phase B) |
| `digit-0.webp` … `digit-9.webp` | Countdown digit sprites | Phase C (not painted yet) |
| `board-skin-4.webp` | Small-grid hero (from `Small-1`) | Phase D (replaces / layers `board-4`) |
| `board-skin-6.webp` | Medium-grid hero (from `Medium-1`) | Phase D |
| `board-skin-8.webp` | Large-grid hero (from `Large-1`) | Phase D |
| `music-neon-circuit.ogg` | Default bed (`neon_circuit_board_game_loop_2min`) | Phase E |
| `sfx-dot-select.ogg` | Terminal / path start | Phase E |
| `sfx-dot-connected.ogg` | Valid pair join | Phase E |
| `sfx-chain-extended.ogg` | Path lengthens | Phase E |
| `sfx-connection-invalid.ogg` | Illegal drag | Phase E |
| `sfx-connection-break.ogg` | Undo / path remove | Phase E |
| `sfx-clear-reset.ogg` | Clear | Phase E |
| `sfx-submit-move.ogg` | Submit press | Phase E |
| `sfx-countdown-tick.ogg` | Normal second tick | Phase C/E |
| `sfx-countdown-final.ogg` | Last second | Phase C/E |
| `sfx-timer-warning.ogg` | Once when low-time begins | Phase C/E |
| `sfx-time-up.ogg` | Clock hits zero | Phase C/E |
| `sfx-new-board.ogg` | Next board loads | Phase E |
| `sfx-board-complete.ogg` | Board solved (server-confirmed) | Phase E |
| `sfx-win.ogg` | Result win | Phase E |
| `sfx-combo-bonus.ogg` | Optional flavour only — never a fake score multiplier | Phase E |

Existing art (`board-4/6/8.webp`, `token-1..8.webp`, `board-frame.webp`) stays until Phase D swaps skins.
