# 14 - Terminology and Wording (part of X8)

The platform is written in trading language throughout. A player who joins for a chess
contest and is called a "Trader", awarded the level "Trading God" and shown a
"Trading Arsenal" will conclude the games are a bolt-on. They will be right, unless this
chapter is done.

This work is identical whether games come from inside or outside, and it is the easiest
part of the programme to do badly.

---

## 1. Why bulk find-and-replace is dangerous

A grep for trading terms returns roughly **5,000 matches**. Almost none of them should be
changed.

| Category | Example | Safe to change? |
|---|---|---|
| User-visible label | `<h3>Total Trades</h3>` | Yes |
| API route, model name, permission key | `/api/trading/prices`, `TradingPosition`, `canTrade` | **No - breaks the app** |
| Log line | `console.log("price update")` | Pointless |
| CSS class, asset filename | `trading-panel` | No user impact |

A regex pass across 5,000 matches will rename a ledger enum or a restriction key and
produce a defect that surfaces days later in the money layer. This is risk **R8** in `17`.

**The actual scope is ~150-250 user-visible strings in the shared shell.** That is a
week of careful work, not a rewrite.

---

## 2. The terminology layer

There is **no i18n layer in the codebase** - no `next-intl`, no `react-i18next`, no
`useTranslation`. Introducing one for 5,000 strings is a project in itself. A token
dictionary for the shared shell gets most of the benefit for a fraction of the cost.

| Piece | Where |
|---|---|
| Token catalogue | `lib/constants/terminology.ts` - a `TERMS` object and a `TerminologyPack` type |
| Platform override | `WhiteLabel.terminologyOverrides` - editable in admin, no deploy |
| Per-game override | `module.terminology` |
| Server accessor | `getTerms(gameType?)` |
| Client hook | `useTerms(gameType?)`, delivered through `AppSettingsProvider` from `/api/settings` |

**Resolution order:** per-game override, then platform override, then the default token.

`AppSettingsProvider` already carries currency and credit labels from `AppSettings`, so
the delivery mechanism exists and is proven. Follow it rather than inventing a second one.

> **AMENDED 15 September 2026, during X6.5 A1. Three rows of that table are wrong, and the
> paragraph under it is wrong in the most expensive direction available - it is an
> instruction to follow a mechanism that does not run.**
>
> **The delivery claim is false for `apps/admin`.** `AppSettingsProvider` exists, and it is
> **mounted nowhere in the admin app** - nineteen admin components call `useAppSettings()`
> and every one of them receives the `createContext` defaults, so the configured credit
> symbol and base currency have never reached a single admin screen. That is its own live
> defect, recorded separately, and the thing to carry from it here is that **"the mechanism
> exists and is proven" was a claim about a file, never about a render tree.** Delivering
> terminology through it would have shipped a wording layer that silently served defaults
> on every screen it was written for, with nothing thrown and nothing logged. What was
> built instead is `apps/admin/contexts/TerminologyContext.tsx` with `TerminologyProvider`
> mounted in the admin **root layout**, and the guard suite carries a **canary** asserting
> `AppSettingsProvider` is still unmounted - so the day somebody fixes that defect, the test
> goes red and this decision gets re-read rather than quietly outliving its reason.
>
> **`useTerms(gameType?)` takes no argument as built.** The per-game layer is not built, so
> a parameter accepted and ignored is the seventh declared-written-dead field in this
> programme. It arrives with the per-game home below or not at all.
>
> **`module.terminology` is the wrong home for a per-game override**, and the reason
> generalises: a game **module** is per *category* - `["trading", "provider"]`, asserted by
> a registry tripwire - and **one provider module backs the whole catalogue**, so a
> module-level dictionary can express one vocabulary for a chess puzzle, a trivia round and
> a time trial at once. Exactly the mistake `requiresSyncPlay` was deleted for. The per-game
> override belongs on the **catalogue row** (`provider_game`), which is also where section 2
> already says it should be populated from - so the storage and the sourcing agree there and
> disagree in the table above.

### Why per-game overrides matter more here

With provider games the vocabulary varies by title in ways an in-house plan would not
have to handle: a chess contest has "puzzles solved", a trivia game has "questions", a
time-attack has "best time". The per-game override layer is what lets each contest read
naturally without a code change per title - and it should be populated from the
provider's own catalogue metadata where possible.

---

## 3. Migration passes

**Split into two phases on 2 September 2026.** This chapter previously sat entirely in X8,
after the player UI. That ordering had a consequence nobody would have chosen deliberately:
operators would spend two whole phases running a multi-game platform through screens
labelled "trading", making exactly the mistakes the relabelling exists to prevent. The
admin half is now **X6.5**, immediately after the admin build; the player half stays in
**X8**.

### 3.1 Admin passes - X6.5

These follow the navigation restructure in `12` section 1, because renaming a screen and
moving it are cheaper together than apart, and because the operator is the first person
who has to think in games rather than trades.

| Pass | Scope | ~strings | Who |
|---|---|---|---|
| A1 | Admin navigation labels and group headers - `AdminDashboard.tsx` `menuGroups` | ~60 sections reviewed, ~25 renamed | Developer |
| A2 | Contest create wizard - step titles, field labels, help text | ~40 | Developer |
| A3 | Contest list and detail column headers | ~25 | Developer |
| A4 | Analytics and financial screen labels, per `05` section 10 | ~30 | Developer |
| A5 | **Admin wiki** - `AdminWikiSection.tsx` | Content | Developer or admin |
| A6 | **AI agent knowledge base** - `apps/admin/app/api/ai-agent/chat/route.ts` | Content | Developer |

> **A1, A2 and A3 are BUILT as of 15 September 2026.** A1 shipped the token layer itself
> rather than only the labels the table describes: `lib/constants/terminology.ts`,
> `WhiteLabel.terminologyOverrides` on both model copies, `getTerms()`, the admin
> `TerminologyProvider` and a Settings -> Wording screen an operator edits with no deploy.
> A2 tokenised the provider contest wizard and its six step bodies; A3 tokenised the contest
> list, the contest detail screen and the prose in `contest-result-presentation.ts`. Each
> carries a structural guard and a PowerShell probe harness.
>
> **The guard asserts more than "the token is used", and the extra assertions are the
> load-bearing ones.** It bans each renameable noun as a **literal** in displayed text, bans
> case-folding and pluralisation of a token (`terms.prize + "s"` is how one operator's
> renamed noun becomes a word they never chose), and asserts that route ids and status values
> stay **literal** - `activeTab=competitions` and `"completed"` are on the never-rename list,
> so a pass that tokenises them is a production defect wearing a copy change.
>
> **Two decisions were taken on 15 September 2026 and both narrow the case-folding rule.**
> A token may appear mid-sentence after a determiner - "this Competition still settles on
> time" - accepting Title Case rather than restructuring every sentence around it; and
> **"Participant(s)" is treated as a synonym of the `players` token** rather than earning a
> token of its own, so an operator has one noun to rename instead of two that can disagree.
>
> **Two scanner exemptions exist and are not laxity.** A Title Case match in a **TypeScript
> type position** is skipped (`interface Competition` is a type name, not something a player
> reads), and **"Game Master"** is exempt, being a protected role name rather than the `game`
> token followed by a word. Without both, the guard fires on correct code, and a guard that
> fires on correct code is the one the next reader deletes.
>
> **A3b and A3c are BUILT as of 15 September 2026, later the same day.**
>
> **A3b closed the lowercase prose - 139 lines across 32 files, now nil.** The reason the
> Title Case sweep had not already reached them is worth carrying: `literalNounHits` is
> deliberately scoped to Title Case, because the lowercase forms are *also* route ids
> (`activeTab=competitions`), stored status values (`"contest"`) and local variable names,
> all on section 6's never-rename list. So every explanatory paragraph on the games screens
> kept its hard-coded nouns while the headings above them were tokenised, and **an operator
> who renamed Competitions to "Events" got a screen whose headings said Events and whose
> sentences underneath still explained how a competition works.** The new
> `lowercaseNounHits` scanner therefore requires a **display signal** - a quoted span
> containing a space, or a run of three or more plain words - rather than matching the word
> anywhere, or it fires on every route id in the codebase. Its guard
> (`__tests__/admin/games-prose-terminology.test.ts`) **reads the directory rather than a
> list of files**, so a screen added to `components/admin/games/` next month is policed the
> day it arrives; and it asserts **first** that the scan found files with content, because
> both of its real claims are "no match was found" and a reader that silently returns
> nothing satisfies both.
>
> **A3c put the operator's nouns inside the two AI content assistants, and that gap was the
> largest single inconsistency the pass would have shipped.** Every other consumer of the
> dictionary reads a word and prints it; these two *write sentences*, and their prompts were
> fixed strings - so a deployment that had renamed Competition to "Tournament" had a wizard
> whose every label said Tournament sitting directly above a generated description that said
> Competition, in the same box, with nothing thrown and nothing logged.
>
> **The clause is a DIFF against the defaults, appended and therefore last.** An
> unconfigured platform gets the empty string, which is the only reason
> `TRADING_SYSTEM_PROMPT_HISTORICAL` survives being asserted character for character - the
> same reasoning that kept the Game Master `||` verbatim while settlement was extracted.
> Splicing it into trading's rule list would have destroyed that guarantee in the very edit
> that adds the feature. Being last is a second, independent benefit: it is the position a
> model resolves a conflict in favour of.
>
> **`terms` has no default value on any of the three vocabulary functions, and that is the
> load-bearing decision.** An optional parameter falling back to the defaults produces
> fluent, correct-looking English in the operator's *old* vocabulary from any call site that
> forgets it - the same shape as `AppSettingsProvider` being mounted nowhere. Required means
> a forgotten call site is a compile error rather than a wrong paragraph.
>
> **The clause enumerates no token**: it is a diff over `TERMINOLOGY_TOKENS`, so a token
> added to the dictionary is covered the day it lands, and a test asserts no token name
> appears as a literal inside it. A hand-picked list of "the tokens that matter to contest
> copy" is a second place to forget one, and the one forgotten is the one somebody has just
> renamed.
>
> **Trading's prompt gets the clause too**, which reads like a contradiction of section 5's
> promise and is not: no trading word is a token, so nothing here can rename "trade",
> "position" or "P&L". What a rename reaches is the platform-neutral nouns trading shares
> with every other game, and a trading prompt that ignored it would produce the only copy on
> the platform still using the old word.
>
> **Still outstanding:** A5 and A6. *(A4 and A6 were both built later the same day - see the
> two notices below. A5 is the only pass left, and by owner decision its content is owner
> work.)*

> **A4 is BUILT as of 15 September 2026, and the pass found a defect larger than the wording
> it set out to fix.** The table above sizes A4 at ~30 strings; **61 sites were tokenised**,
> across `CompetitionAnalytics.tsx`, `FinancialDashboard.tsx`, the transaction dialog and the
> admin challenge detail page. That undercount is not the interesting part.
>
> **Opening these screens to tokenise them is the sixth time that has been a better
> bug-finding instrument than looking for bugs**, and what it found is **R92**: every
> challenge on both screens reported a P&L, an ROI, a trade count and a win rate - four
> figures a puzzle or a race does not have - because `challengerFinalStats` /
> `challengedFinalStats` declared only trading's numbers and **nothing had ever written a
> score into them.** Both halves of the seam were missing at once, so the read side had
> nothing to read and the write side had nowhere to put it. It is the **competition** score
> seam (R32/R33) one contest type along.
>
> **The write half is closed and the read half is not, and the count is the finding.** `score`
> is now declared on both `challenge.model.ts` copies with **no default** (R50 - a stored zero
> is a phantom result) and written from both `challenge-outcome.ts` copies; the two screens
> A4 owns render it behind a **shared** subline rule, so the analytics card and the detail
> page cannot answer the game question differently, and an absent score renders **`-`, never
> `0`**. But `rg` over the two field names found **seven** readers where the task named two.
> The five that remain are named in `17` R92 with a **canary asserting each is still an
> offender**, and the two worth knowing here are that **the player's own result page** shows
> the person who *paid* `$0.00` and `0 trades` (X7 by phase), and that **the AI agent's
> challenge report carries P&L and no score at all** - which is **A6, still pending in this
> very phase**. *(A6 landed later the same day and closed it; the sentence is correct as
> history. Four readers remain, not five.)* *(AMENDED 16 September 2026: **one** remains.
> The owner took the three administration readers ahead of A5 because each is a screen X7
> would otherwise have copied - `ChallengesAdminSection.tsx`'s drawer, which wrote the four
> trading figures **twice, once per side**, and **both** copies of `profile.actions.ts` - and
> the remaining reader is the player's own challenge result page, which is X7 by phase rather
> than deferred by effort. **AMENDED 18 September 2026: that last reader CLOSED (R92)** — the
> player challenge page branches to `ProviderChallengeLobby` before any `myStats.pnl` read;
> canary flipped. **Say which.** **The transferable finding is that removing a phantom zero is not
> a display-only change:** `ProfileOverview.tsx` and `ProfileContent.tsx` each called
> `pnl.toFixed(2)` inline, so the moment the action returned `null` both would have thrown -
> **something downstream was relying on the zero being printable** - and the answer is
> `lib/utils/profile-result-metric.ts`, one rule both screens ask, which **decides by GAME and
> never by which figures are present**, since `buildParticipantSeat` writes `pnl: 0` onto
> every seat whatever the game, so a presence test answers trading for every row ever
> written. An absent ROI is **withheld outright rather than dashed**, a tile captioned "ROI"
> holding a dash being a question it then declines to answer. `apps/admin`'s copy of the
> action is **dead code and was fixed anyway**, recorded as unreached, on the R42 precedent
> that two copies agreeing while one runs is the failure nobody sees.)*
>
> **That AI-agent sentence first read "it will state a `challenger_pnl` in a confident
> sentence", and that was wrong. Corrected here rather than reworded**, on the R7 and R31
> precedent: those lines fall back to **`"—"`, not `0`**, so the agent invents nothing - the
> defect is that it has **no performance figure for a provider challenge to explain with**,
> and the phantom zeros in that file are on its **competition** reports. The guard moved with
> the correction: the canary asserts the **absence of `score`**, because aimed at the presence
> of `challenger_pnl` it would have stayed green straight through A6.
>
> **The ledger's labels are tokenised and its KEYS are not**, which is the one assertion in
> A4's suite that fails when somebody is helpful. `FinancialDashboard` maps a
> `WalletTransaction.type` to a caption, so an operator who renamed Competition reads "Event
> Entry" in their own ledger view. The keys beside those captions are **stored enum values on
> documents already written**: renaming one orphans every row holding it and the screen then
> shows a blank label against real money, with nothing in a log.
>
> **Two scanner faults were fixed on the way, and both were blind spots rather than false
> alarms.** The literal scan was reading `import` / `export` specifiers as untokenised prose,
> and its identifier test mistook member access - `Challenge.findById` - for a caption. Both
> are now covered by a **fixture-based** suite over the helper itself, because a scanner
> loosened to stop a false positive is the most dangerous file in a terminology pass: it goes
> quiet rather than wrong, and every guard built on it keeps reporting green.
>
> Separately, `wordRuns` was rewritten from a single pattern to a tokenise-then-merge, because
> the original nested a `+` inside a `{2,}` and backtracked polynomially - `security/detect-unsafe-regex`
> was right, on a helper that reads every file in the admin app.

> **A6 is BUILT as of 15 September 2026, and the table above sizes it as "Content" when
> two thirds of it were defects.** The pass set out to reword a knowledge base. What it found
> is that the agent could not answer a question about a game at all, and that two of R92's
> readers lived here.
>
> **The knowledge base opened "ChartVolt is a trading competition platform", and that one
> sentence is the whole shape of the defect.** Asked how to publish a contest on a provider's
> game, the agent answered out of the trading material - fluently, with a starting capital and
> a leverage setting, naming screens that do not exist - because that was the only material it
> had. There is no error and nothing in a log, which is the failure mode this programme keeps
> meeting: **the system reports success while doing the wrong thing.** A document that
> confidently describes the wrong platform is worse than one that says nothing.
>
> **The split is by SUBJECT, not by length.** `games-knowledge-base.ts` holds what is true of
> a provider game - the catalogue, providers and credentials, the round lifecycle, the play
> shapes, attempts, scores and their direction, the unresolved-round and unscored-contest
> policies, the round inspector and manual resolution - and `knowledge-base.ts` keeps the
> trading half with **its sections relabelled "(TRADING)"** so a reader can tell which is
> which. Its header now asks the next author the question that matters: *is this fact true of
> every game, or only of trading?*
>
> **It enumerates no game.** A test forbids a game code, a provider key or a title's name
> anywhere in the games material, so the agent describes the *mechanism* and a new title is
> covered the day it is synced. A knowledge base naming Circuit Sprint is the same failure as
> an aggregate that enumerates game types, one layer out - it reads perfectly and is silently
> incomplete for the next game.
>
> **Every navigation path in the file was stale, and that is a second, separate defect.** The
> nav was restructured in `12` s1 on 2 September and the knowledge base still said "Admin
> Panel → Settings → Credit Conversion" and eleven more like it. **An instruction to visit a
> screen that does not exist is worse than no instruction**, because the operator concludes
> the feature is missing. Every path was re-derived from `menuGroups` and
> `game-sections.ts` - **read from the code, never from the prose**, which is how R93 surfaced:
> the credit-conversion screen the file sent operators to is **mounted nowhere**, so the
> EUR-to-credits rate is genuinely unreachable. The file now says so and names the risk rather
> than inventing a path.
>
> **The level-title claim was corrected on the R88 finding**, not reworded: it told operators
> the ladder's names are theirs to rename, which was false at six read sites until that
> morning, and is a fact about a *feature* rather than a label.
>
> **The vocabulary clause is A3c's, reused rather than rebuilt.** `SYSTEM_PROMPT_BASE` plus
> `vocabularyRule(terms)`, appended and therefore last, empty when nothing is configured - so
> `TRADING_SYSTEM_PROMPT_HISTORICAL` is still asserted character for character. A second
> implementation of the same diff is the "one rule, two copies" shape, and here the drift
> reads to an operator as the agent using a word they retired.
>
> **The R92 remainder in this file was an ABSENCE, and its canary had to be aimed at the
> absence.** The agent's challenge report carried P&L and, for a provider challenge, a dash -
> so it could name the winner and had **no figure to explain why they won**. It now carries
> the score. The competition reports are the phantom-zero half: their performance figures now
> come from **one** producer that **withholds** the trading fields on a provider contest
> rather than zeroing them, and the file's phantom-zero count is asserted to be **nil**.
>
> **One thing found here is not a wording defect and must not be summarised as one.** The
> winner tool ordered participants on `pnl` when no final leaderboard was stored, and
> **ordering on `score` instead does not fix it** - the direction lives on the catalogue title,
> so on a time trial the winner holds the *lowest* score and a guess would name the loser and
> hand them a medal. It now **declines** for a provider contest and says why; the live
> leaderboard orders on `currentRank`, which already has the direction applied. **A refusal
> that names the missing thing beats a plausible answer** - the same choice as the provider
> with no adapter and the withheld Edit control.
>
> **14 tests, 14 probes red on exactly the expected test.** Two of A4's canaries fired the day
> A6 closed and were **flipped, not deleted**: the comments recording that the first claim
> about this file was wrong, and that the challenge canary had to watch for the absence of
> `score`, are the most valuable part of them.
>
> **Two probing notes worth carrying.** Three probes reported `DID NOT APPLY`, and two of them
> because the pattern carried an **em dash**: PowerShell 5.1 decodes a BOM-less `.ps1` with
> the system ANSI codepage, so the character never matches and the probe reads like a moved
> target rather than an unrepresentable one - **keep every probe pattern ASCII**, and anchor on
> the line above when the line you want contains a dash. The third was an indentation
> mismatch. And the admin typecheck is at **226**, not the 223 recorded on 7 September; the
> lists were diffed rather than the counts, and they are identical - **a stale baseline reads
> exactly like a regression.**
>
> **A5 engineering is BUILT as of 19 September 2026.** The overview no longer calls the
> platform a "trading competition platform"; it describes a multi-game competition platform
> and surfaces a Game Administration card. Ten empty topics under category
> **Game Administration** live in
> `apps/admin/components/admin/wiki/game-administration-skeleton.tsx` and are spread into
> `AdminWikiSection.tsx` after Competitions / before Fraud. Each skeleton carries an outline
> of what to author and a "To be completed" banner — **body authoring remains owner work**,
> by the 15 Sep decision. **Owner 19 Sep 2026: fill these bodies at the END OF ALL other
> work** — not next, not interleaved with eng. Pinned by `__tests__/admin/wiki-a5-game-admin.test.ts`
> (3 tests). A document listing A5's reword or skeleton as outstanding is correct as history
> and stale as a present fact — **say which**. A document treating wiki fill as the next
> action is stale from 19 Sep — **say which**.

**A5 and A6 are the two that get forgotten, and both are worse than a stale label.** The
wiki is what an operator reads when they are unsure, and the AI agent actively advises
them - a knowledge base that still describes a trading-only platform will confidently give
wrong guidance. Prerequisite B had to update both for exactly this reason; treat them as
part of the pass, not as documentation to catch up later. **A6 and A5's engineering half
are now both closed; only the owner-authored wiki bodies remain, and those are scheduled
last of all (19 Sep).**

### 3.2 Player passes - X8

Ordered by visibility, so the highest-impact strings change first.

| Pass | Scope | ~strings | Who | Status |
|---|---|---|---|---|
| 1 | Navigation - `UserSidebar.tsx`, `MobileBottomNav.tsx` | ~10 | Developer | **BUILT 19 Sep 2026** — see s3.2a |
| 2 | Level titles, via the `XPConfig` database record | 20 | Admin | Outstanding (R88 closed in X6.5; content still operator) |
| 3 | Contest shell — `components/games/` (+ trading lobby keeps trading language) | ~50 | Developer | **BUILT 19 Sep 2026** — see s3.2b |
| 4 | Leaderboard columns and headings | ~25 | Developer | **BUILT 19 Sep 2026** — see s3.2c |
| 5 | Dashboard header and section titles | ~30 | Developer | Outstanding |
| 6 | Profile tabs and headings | ~30 | Developer | Outstanding |
| 7 | Notification and email templates (database) | ~25 templates | Admin | Outstanding |
| 8 | Badge and milestone **content** - never IDs | data | Admin | Outstanding |
| 9 | Landing and hero content (database) | data | Admin | Outstanding |
| 10 | Help centre core | ~40 | Counted in `13` | Outstanding |
| 11 | Legal pages | separate | Legal | Outstanding |

#### 3.2a Pass 1 — player navigation (BUILT 19 Sep 2026)

**What shipped:** `contexts/TerminologyContext.tsx` (player mirror of the admin provider),
mounted in `app/(root)/layout.tsx` with `getTerms()` + `noStore()`, and both nav surfaces
reading tokens:

| Site | Was | Token |
|---|---|---|
| `UserSidebar` section header | `"Trading"` | `terms.games` |
| `UserSidebar` / level fallback | `"Trader"` | `terms.player` |
| Competitions / Challenges / Leaderboard labels | hard-coded | `terms.contests` / `terms.challenges` / `terms.leaderboard` |
| Mobile bottom nav same three | hard-coded | same |

Routes stay `/competitions`, `/challenges`, `/leaderboard` — identifiers are never-rename
(chapter 14 s6). **15 tests** in `__tests__/player/terminology-delivery.test.ts`; the
admin delivery tripwire that asserted "no main-app TerminologyContext" was **flipped**, and
`vitest.config.ts` now aliases `@/contexts/TerminologyContext` to the main-app file.

**Not built:** passes 2–11; auth/landing trees still have no provider until a later pass
reaches them.

#### 3.2b Pass 3 — provider contest shell (BUILT 19 Sep 2026)

**What shipped:** high-visibility nouns on the provider lobbies and arena panels.

| File | Mechanism | Tokens |
|---|---|---|
| `ProviderContestLobby.tsx` | `getTerms()` | `contests`, `players`, `prizePool`, `entryFee`, `leaderboard`, `contest`, `game` |
| `ProviderChallengeLobby.tsx` | `getTerms()` | `challenges`, `challenge`, `opponent`, `game` |
| `ArenaLeaderboardPanel.tsx` | `useTerms()` (client) | `leaderboard`, `players`, `contest`, `score` |
| `ArenaContestPanel.tsx` | `getTerms()` (async) | `prizePool`, `entryFee`, `players`, `round`, `score`, `rank`, `attempt` |
| `ArenaIdentity.tsx` | `getTerms()` (async) | `contest` |

**Trading lobby untouched** (chapter 14 s5). **7 tests** in
`__tests__/player/contest-shell-terminology.test.ts`.

**Deviation:** arena identity + contest panel each call `getTerms()` rather than receiving
a pack from the play page — same answer while overrides are platform-wide; threading one
read belongs with a later cleanup if per-request cost matters.

**Not built:** passes 2, 4–11; remaining strings inside `components/games/` (results screen,
pre-flight copy, etc.).

#### 3.2c Pass 4 — leaderboard columns and headings (BUILT 19 Sep 2026)

**What shipped:** board picker labels, page titles and table chrome on `/leaderboard`.

| File | Mechanism | Tokens |
|---|---|---|
| `app/api/leaderboard/route.ts` | `getTerms()` | `leaderboard`, `games` (picker labels) |
| `LeaderboardClient.tsx` | `useTerms()` | `leaderboard`, `games`, `players`, `contest`, `game`, `player` |
| `GlobalLeaderboardTable.tsx` | `useTerms()` | `rank`, `player`, `games`, `contests`, `level`, `score`, `players` |
| `GameLeaderboardTable.tsx` | `useTerms()` | `rank`, `player`, `score`, `players`, `games`, `game`, `contest` |
| `LeaderboardContent.tsx` (Trading board) | `useTerms()` | `leaderboard`, `rank`, `score`, `contests`, `contest`, `challenge`, `player` — **Trader / P&L stay literal** |
| `LeaderboardChallengeButton.tsx` | `useTerms()` | `challenge` |

**Trading board keeps trading metric nouns** (Trader, P&L, Win Rate) — chapter 14
boundary 1 / section 5. "Trading" beside `terms.leaderboard` is the game name, not a
token. **10 tests** in `__tests__/player/leaderboard-terminology.test.ts`.

**Not built:** passes 2, 5–11; MatchmakingCards skill-band labels; remaining explainer
metric jargon that is not a renameable shell noun.

---

Passes 2, 7, 8 and 9 are **database content, editable in admin by someone who is not a
developer**. That is roughly three days of work that does not consume engineering time,
and it can happen in parallel with X7.

> **AMENDED 15 September 2026. Two rows of that table describe something other than the
> codebase, and pass 2 is the more serious of the two because it is costed as free.**
>
> **`components/contest/` does not exist**, in either app - checked. The player contest
> surface is `components/games/` (the provider lobby, the play screen, the arena) and
> `components/trading/lobby/` (the trading lobby), which is also what section 7's proposed
> ESLint rule names, so that rule as written would police an empty path and report nothing.
> Scope pass 3 against the two real directories, and note the split is not cosmetic: the
> trading lobby **deliberately keeps** trading language under section 5, so a single rule
> over one merged path would be wrong in one half whichever way it was written.
>
> **Pass 2 is not a database edit, and the sentence below the section 4 table saying it is
> "the highest-value single change" is right about the value and wrong about the mechanism.**
> Two functions share the name `getTitleByXP`: an **async** one in `xp-config.service.ts`
> that reads `XPConfig` from the database, and a **synchronous** one in
> `lib/constants/levels.ts` that reads the hard-coded twenty-entry `TITLE_LEVELS` array. The
> XP award path uses the database one and stores its answer on `UserLevel.currentTitle`.
> **Five read sites use the hard-coded one** - `app/api/leaderboard/route.ts`, both apps'
> `competition.actions.ts`, the admin global leaderboard, and the contest-entry level gate -
> so an operator renaming the ladder in admin changes the profile and **every leaderboard row
> keeps saying "Novice Trader"**. Nothing throws and nothing logs. Recorded as risk **R88**;
> pass 2 costs a code change before it costs an admin edit.
>
> The leaderboard route is the clearest instance and the most instructive: it already calls
> `getUsersWithTitles`, which returns the `UserLevel` documents **carrying the stored
> `currentTitle`**, and then discards that field and recomputes the title from the constant.
> **The correct value was in hand and was thrown away** - so the fix is to read the stored
> field, not to make five call sites `await` a second database read. Related and worth
> stating because `check:mirrors` cannot: `lib/constants/levels.ts` and
> `apps/admin/lib/constants/levels.ts` are two copies of that array, **byte-identical
> today**, and the guard compares models, so it has never had an opinion about them.
>
> **AMENDED 15 September 2026 on fixing it, and the paragraph above is wrong twice.** There
> were **six** read sites, not five - `app/(root)/competitions/[id]/page.tsx` recomputes from
> the constant too - and `comprehensive-dashboard.actions.ts` is the same disagreement facing
> the other way, having scanned the operator's ladder and then taken the stored title anyway.
> **And the prescription is wrong: `currentTitle` is a cache written at XP-award time**, so
> reading it leaves a renamed ladder stale on every row until each player next earns XP, and a
> player who has stopped playing keeps the old name for ever - *some* rows renamed and some
> not, which is worse than a uniformly old name because it is the version a player reports as
> a bug. The fix reads the **ladder**, through `lib/utils/level-title.ts`, **once per board and
> passed in**; the `await` this paragraph was avoiding costs one read per board, not per row.
> Icon and colour still come from the code ladder, matched on the level **number**, because an
> operator owns words and does not own a `GAME_ICONS` key or a Tailwind class. **CLOSED**, with
> R89, R90 and R91 found on the way.

**One player-side item was deliberately *not* in this chapter.** The getting-started card
(`components/dashboard/GettingStartedCard.tsx`) had a step "place your first trade". That
is a **logic** change - which steps exist and when they count as complete - not a string
change, so it belonged with the onboarding work in `20` section 5. **CLOSED 18 Sep 2026**
(`20` s5 BUILT) — a wording pass that merely relabelled it would have left a new player
on a games platform with a trading task; the play step is now game-aware and gated on
`tradingEnabled`.

---

## 4. The high-visibility strings

| Location | Today | Proposed |
|---|---|---|
| `UserSidebar.tsx` section header | "Trading" | "Compete" or "Games" |
| `UserSidebar.tsx`, `UserDropdown.tsx` fallback name | "Trader" | "Player" |
| `/api/user/level` default title | "Trader" | "Player" |
| `lib/constants/levels.ts` - 20 titles | "Novice Trader" through "Trading God" | Neutral ladder, via `XPConfig` |
| `app/layout.tsx` metadata | "Live Market competition Trading Platform" | Platform-level, game-neutral |
| `LiveStatsBar` | "Active Traders" | "Active Players" |
| Landing feature card | "Trading Competitions" | "Skill Competitions" |
| Marketplace | "Trading Arsenal" | Keep for trading items; see `16` |
| `/help` headings | "Trader's Journey", "Trader Levels" | "Your Journey", "Levels" |
| Journey default map | "Trader's Journey" | "Your Journey" |
| Arena banner | "LIVE TRADING BROADCAST" | Keep - it is a trading broadcast |

The level ladder is the highest-value single change. Twenty titles, all trading-themed,
shown on every profile and leaderboard row - and it is a **database edit**, not a code
change.

> **CORRECTED 15 September 2026: the last clause is false.** It is a database edit **plus** a
> code change, because five read sites bypass `XPConfig` for the hard-coded `TITLE_LEVELS`
> array - including the leaderboard, which is half of what makes the row high-value in the
> first place. Risk **R88**, and the full mechanism is in the amendment under section 3.2. The
> sentence is left standing rather than rewritten because it was believed, and a document
> that claims this is free is how somebody schedules it as an admin task.
>
> **CLOSED 15 September 2026**, scoped into X6.5 by the owner rather than deferred to X7. It
> was **six** read sites and not five, and three further defects came with the fix: four
> unauthenticated routes over the ladder (**R89**), six screens holding their own list of rung
> names - the **difficulty-band vocabulary mislabelled as levels**, so wrong by position rather
> than stale (**R90**) - *(one of those six, the Game Master's create-contest screen, was left
> standing behind a canary that day and **closed on 16 September 2026**: it needed the ladder
> threaded in from a server component, and the interesting half was not the stale names but
> the `maxLevel` cap of **10**, which is not a wording fault at all - a Game Master could not
> restrict a contest to the upper half of a twenty-rung ladder, so the fix restores a
> capability rather than a caption)* - and the ladder **editor** able to replace a renamed twenty-rung ladder
> with ten stale rungs after one failed fetch (**R91**). So the row is now genuinely a database
> edit; it was three code changes and a refusal away from being one.

---

## 5. What deliberately keeps trading language

A trader should not be able to tell this programme happened.

- Every screen under `/trade` and the whole `components/trading/` stack
- The trading help guide and glossary - `lib/constants/trading-terms.ts`
- Trading notification types: `order_placed`, `position_opened`, `margin_warning`,
  `margin_call`, `liquidation`
- The Arena broadcast
- The Trading Arsenal, for trading items

---

## 6. Things that must never be renamed

Each of these is a load-bearing identifier. Renaming one is a production defect, not a
copy change.

| Category | Examples | Consequence of renaming |
|---|---|---|
| API routes | `/api/trading/*`, `/api/competitions/*`, `/api/challenges/*` | Broken clients, broken notification links |
| Model names | `TradingPosition`, `TradeHistory`, `CompetitionParticipant` | Broken queries across two apps |
| Ledger enums | `competition_entry`, `competition_win`, `challenge_entry` | **Orphans financial history** - risk **R13** |
| Ranking method IDs | `pnl`, `roi`, `total_capital`, `win_rate`, `total_wins`, `profit_factor` | Stored on existing contests |
| Restriction keys | `canTrade`, `canEnterCompetitions`, `canEnterChallenges` | Silently disables enforcement |
| Status values | `liquidated`, `disqualified`, `completed`, `refunded` | State machine breaks |
| Badge and milestone **IDs** | any | **Orphans user progress** - risk **R12** |
| Notification template type keys | any | Templates stop resolving |
| Environment variable and settings keys | any | Configuration silently reverts to defaults |
| `gameKey` | any | **Immutable.** It is the join key for all historical per-game stats |

`gameKey` deserves emphasis in this folder specifically: it encodes the provider and the
title. Once a single score is written against it, it can never change - not when the
provider renames a game, not when a contract moves to a new provider. See `02`.

---

## 7. Enforcement

- An ESLint rule flagging literal trading words in `components/contest/`,
  `components/dashboard/` headers and `components/leaderboard/`
- A review checklist item: any string change touching an identifier list in section 6 is
  rejected
- The existing husky pre-commit hook already runs `eslint --max-warnings=0`, so a rule
  added here is enforced automatically

> **AMENDED 15 September 2026. What was built is a vitest guard, not an ESLint rule, and the
> substitution is deliberate.** `components/contest/` and `components/leaderboard/` do not
> exist (see the section 3.2 amendment), so the rule as specified would police two empty
> paths. More to the point, the property that needs enforcing is **not** "no trading word
> appears here" - it is **"no renameable noun appears as a literal, no token is case-folded
> or pluralised, and every route id and status value stays literal"**, and the last two
> cannot be expressed as a word list at all. A lint rule that flags a word is also green
> against the one mutation that matters most: a screen that imports the pack and then
> hand-writes the noun beside it.
>
> The guards are `__tests__/admin/wizard-terminology.test.ts` and
> `__tests__/admin/contest-screens-terminology.test.ts`, sharing one scanner in
> `__tests__/helpers/terminology-scan.ts`. **The scanner is shared rather than copied**
> because two copies of one vocabulary rule is the "one rule, two copies" shape behind
> `referenceId`, `failedReason`, `challengeId` and the Game Master `||`, none of which
> `check:mirrors` can see - and here the drift reads as a screen that passed review while
> serving an operator a noun they renamed. It **strips comments before matching**, because
> these files explain the anti-patterns in prose, so a guard that reads prose flags a correct
> file for discussing the mistake and passes a broken one whose only mention of the token is
> in a comment.

---

## 8. Effort

Split across the two phases, per section 3.

### X6.5 - admin

| Item | Estimate |
|---|---|
| Terminology layer - tokens, resolution, hook, database field, admin UI | 3 days |
| Passes A1-A4 - roughly 120 admin strings, alongside the `12` s1 restructure | 2-3 days |
| Passes A5-A6 - admin wiki and AI agent knowledge base | 1 day |
| **X6.5 total** | **~0.5-1 week** |

The terminology layer itself is built here rather than in X8, because the admin overrides
UI is the thing that lets a non-developer do the X8 data-entry passes at all.

### X8 - player

| Item | Estimate |
|---|---|
| Passes 1, 3, 4, 5, 6 - roughly 145 code strings | 5 days |
| Passes 2, 7, 8, 9 - admin data entry | 3 days, **non-developer** |
| Per-game overrides populated from provider catalogue metadata | 1 day |
| Guardrails - lint rule and checklist | 1 day |
| **X8 engineering** | **~7 days** |

**Total engineering across both phases is unchanged at ~10 days.** The split moves work
earlier; it does not add any.

---

## 9. Acceptance criteria

- [ ] A player who has only played provider games encounters **no trading vocabulary**
      anywhere in the shared shell
- [ ] A trader notices **no change** on `/trade`, in trading help, or in trading
      notifications
- [ ] Every string in section 4 is changed
- [ ] Nothing in section 6 is changed - verified by diff review, not assertion
- [ ] Terminology is editable from admin **without a deploy**
- [ ] Per-game vocabulary reads naturally for at least two different provider titles

### Admin criteria, X6.5

- [ ] An operator can administer a provider contest end to end **without reading the word
      "trading"** outside the Trading section
- [ ] The **admin wiki** describes a multi-game platform, not a trading platform
- [ ] The **AI agent knowledge base** does not describe trading as the only game - it
      advises operators directly, so a stale entry produces confidently wrong guidance
- [ ] No analytics or financial figure is labelled as a platform total while covering only
      trading (`05` section 10)
