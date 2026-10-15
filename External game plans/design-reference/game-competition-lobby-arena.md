# ChartVolt – Game Competition Lobby (Arena)

**Primary visual reference:** `game-competition-lobby-arena-target.jpg`  
(Owner redesign — Circuit Sprint mock; layout is kind-agnostic for every provider-game lobby, never trading.)

## BUILT (15 Oct 2026, eng)

Desktop three-column arena + dedicated phone tree for **provider-game** competition lobbies only. Trading stays on `CompetitionDetailShell` / trading mobile.

### Center-stage polish (same day, owner image 1)

Matched the clean neon center panel: gamepad circle + short game title (uppercase), gold/cyan rule badges, blurb under badges, `CountdownPanel` size **`arena`** (cyan neon cells, no arena-blur backdrop — trading keeps `showcase`), info bar with `i`, gold chevron **PLAY** with `>>>` / `<<<`. Live code: `LobbyCenterStage.tsx`, `CountdownPanel.tsx` (`arena`), `CompetitionEntryButton` arena PLAY branch.

| Piece | Live code |
|---|---|
| Desktop shell (~23 / 55 / 22) | `components/games/lobby/GameCompetitionArenaShell.tsx` |
| Center stage (badges, showcase countdown, gold PLAY) | `components/games/lobby/LobbyCenterStage.tsx` |
| Contest stats 2×3 | `components/games/lobby/LobbyContestStatsGrid.tsx` |
| Hero feature pills | `components/games/lobby/LobbyHeroFeaturePills.tsx` |
| Phone order | `components/games/lobby/mobile/MobileGameCompetitionLobby.tsx` |
| Wiring | `components/games/ProviderContestLobby.tsx` (`min-[769px]` split) |

**Preserved:** real competition data, Join/Play, one-attempt rules, prize breakdown (`LobbyLivePrizePanel`), standings poll (`ArenaLiveProvider`), Global/Friends/Country filters, Volts formatting. How It Works / Game Tips sit under the main columns (no tall empty band). Anytime contests do not mention choosing a time slot.

**Tests:** `contest-lobby-shell.test.ts`, `contest-countdown.test.ts`, `provider-play-ui.test.ts`, `contest-shell-terminology.test.ts`, `shared-back-link-and-tooltip.test.ts` (197 green).

**Never verified by eye** — both trees are behind sign-in; owner review on desktop + a real phone still required.

## Objective (owner brief)

Recreate the premium ChartVolt competition lobby while preserving all existing functionality. Agnostic for all game competition lobbies; not trading.
