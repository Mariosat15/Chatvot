# Design reference — the owner's supplied mocks

Every file here is a **mock**, not a screenshot of the running app. That distinction cost a
correction once already and is the reason this file exists: `trading-lobby-target.png` was
committed on 6 September 2026 as `trading-lobby-as-built.png`, and a later summary read it as
evidence that the trading lobby already looked like this. It never did. The two files were then
found to be **byte-identical**, which is what proved the label wrong rather than merely doubtful.

**Do not add a file here without saying in this table whether it is a mock or a capture.**

| File | What it is | Status |
|---|---|---|
| `component-sheet-banners-cards-buttons.png` | The design system laid out as parts — four hero banners, the stat cards for both game and trading figures, the four status cards, the five buttons, leaderboard rows, avatars, the equity chart and the six accordion headers | **Mock.** This is the sheet the `components/neon/` kit was built from, and it is the authority when two mocks disagree |
| `game-lobby-target-and-style-sheet.png` | The Circuit Perfect game lobby beside an earlier, smaller version of the same sheet | **Mock.** Built, 6 Sep 2026 — see `13` s4.1c and s4.1d |
| `trading-lobby-target.png` | The trading lobby in the same style, with the equity chart, the trading figures and the six collapsed accordions | **Mock.** Built, 6 Sep 2026 — s4.1d. Two things in it are **not** built: the announcements panel and the "Share Event" button, neither of which exists as a feature |
| `future-dashboard.png` | The signed-in dashboard: credits, arena rank, badges, journey, active arenas split into trading and games | **Mock. Not built.** Its contest cards became game-aware on 6 Sep 2026 (`13` s5.1a), which is a correctness fix and not this styling |
| `future-competitions-hub.png` | `/competitions` as a filterable hub with per-game artwork and difficulty pips | **Mock. Not built.** The live list is a table |
| `future-game-arena.png` | A games home with trending titles, live competitions and achievements | **Mock. Not built.** There is no such route; it is roughly `New games plan` P7's catalogue |
| `future-leaderboards.png` | Global rankings across trading and games, with a scoring breakdown | **Mock. Not built,** and it is the one that depends on more than styling: a cross-game total is `05` s10's binding rule, so the figures it shows have to exist before the screen can |

## The one thing to read before styling anything else from these

The four `future-*.png` mocks show **features**, not skins. Several of the numbers in them —
credits, arena level, XP, badges, streaks, a cross-game total score — have no source in the
codebase today. Building the screen first produces a page of plausible zeros, which is worse than
not building it: a figure that renders is believed. Each one needs its data settled first, which
is why the reach of the 6 September restyle was **the two lobbies only**, by owner decision.
