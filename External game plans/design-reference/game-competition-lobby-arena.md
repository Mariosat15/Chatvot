# ChartVolt – Game Competition Lobby (Arena)

**Primary visual reference:** `game-competition-lobby-arena-target.jpg`  
(Owner redesign — Circuit Sprint mock; layout is kind-agnostic for every provider-game lobby, never trading.)

## BUILT (15 Oct 2026, eng)

Desktop three-column arena + dedicated phone tree for **provider-game** competition lobbies only. Trading stays on `CompetitionDetailShell` / trading mobile.

### Categories, summary row, glow and PLAY plate (later 15 Oct 2026, owner images 1-3)

- The long text marked in green is sorted into trading-style rule cards. `GameEventDetails` has four sections (How you play / Scoring / Play window / If something goes wrong), with short values and the full sentence behind a `?` tip.
- The centre info bar is now fact chips (`buildStageFacts` in `game-lobby-copy.ts`).
- `GameLobbySummary` is a 4-card row like trading's: prize pool, entry, players, ends in. It reads live values from `useArenaLive()`, and the right-column grid no longer repeats them.
- The side columns glow through a `drop-shadow` filter. `NEON_PANEL` is deliberately unchanged.
- PLAY is `ArenaPlayPlate` (`components/games/lobby/ArenaPlayPlate.tsx`): a gold bevel, a top gloss and glowing cyan chevrons. The glow sits on a `drop-shadow` wrapper because `clip-path` clips `box-shadow`, which is why the previous plate looked plain.
- **Never verified by eye.**

### Center-stage polish (same day, owner image 1)

Matched the clean neon center panel: gamepad circle + short game title (uppercase), gold/cyan rule badges, blurb under badges, `CountdownPanel` size **`arena`** (cyan neon cells, no arena-blur backdrop — trading keeps `showcase`), info bar with `i`, gold chevron **PLAY** with `>>>` / `<<<`. Live code: `LobbyCenterStage.tsx`, `CountdownPanel.tsx` (`arena`), `CompetitionEntryButton` arena PLAY branch.

| Piece | Live code |
|---|---|
| Desktop shell (~23 / 55 / 22) | `components/games/lobby/GameCompetitionArenaShell.tsx` |
| Center stage (badges, showcase countdown, gold PLAY) | `components/games/lobby/LobbyCenterStage.tsx` |
| Contest stats 2×3 | `components/games/lobby/LobbyContestStatsGrid.tsx` |
| Hero feature pills | `components/games/lobby/LobbyHeroFeaturePills.tsx` |
| Phone order | `components/games/lobby/mobile/MobileGameCompetitionLobby.tsx` — **rebuilt 15 Oct 2026** per `ChartVolt_Game_Competition_Lobby_Mobile_Cursor_Guide (1).md`: back → cover hero → one status countdown → Your Run → essentials → tabs (Overview / Leaderboard / Prizes / Rounds / Tips). Not a stacked desktop. |
| Wiring | `components/games/ProviderContestLobby.tsx` (`min-[769px]` split) |

**Preserved:** real competition data, Join/Play, one-attempt rules, prize breakdown (`LobbyLivePrizePanel`), standings poll (`ArenaLiveProvider`), Global/Friends/Country filters, Volts formatting. How It Works / Game Tips sit under the main columns (no tall empty band). Anytime contests do not mention choosing a time slot.

**Tests:** `contest-lobby-shell.test.ts`, `contest-countdown.test.ts`, `provider-play-ui.test.ts`, `contest-shell-terminology.test.ts`, `shared-back-link-and-tooltip.test.ts` (197 green).

**Never verified by eye** — both trees are behind sign-in; owner review on desktop + a real phone still required.

## Objective (owner brief)

Recreate the premium ChartVolt competition lobby while preserving all existing functionality. Agnostic for all game competition lobbies; not trading.
