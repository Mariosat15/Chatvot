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
> **Still outstanding:** A3b, the ~139 lines of lowercase renameable nouns in running prose
> across 32 files, plus extending the guard to ban lowercase literals; A3c, appending a
> vocabulary clause to the AI prompt; and A4-A6.

**A5 and A6 are the two that get forgotten, and both are worse than a stale label.** The
wiki is what an operator reads when they are unsure, and the AI agent actively advises
them - a knowledge base that still describes a trading-only platform will confidently give
wrong guidance. Prerequisite B had to update both for exactly this reason; treat them as
part of the pass, not as documentation to catch up later.

### 3.2 Player passes - X8

Ordered by visibility, so the highest-impact strings change first.

| Pass | Scope | ~strings | Who |
|---|---|---|---|
| 1 | Navigation - `UserSidebar.tsx`, `MobileBottomNav.tsx` | ~10 | Developer |
| 2 | Level titles, via the `XPConfig` database record | 20 | Admin |
| 3 | Contest shell in `components/contest/` | ~50 | Developer |
| 4 | Leaderboard columns and headings | ~25 | Developer |
| 5 | Dashboard header and section titles | ~30 | Developer |
| 6 | Profile tabs and headings | ~30 | Developer |
| 7 | Notification and email templates (database) | ~25 templates | Admin |
| 8 | Badge and milestone **content** - never IDs | data | Admin |
| 9 | Landing and hero content (database) | data | Admin |
| 10 | Help centre core | ~40 | Counted in `13` |
| 11 | Legal pages | separate | Legal |

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

**One player-side item is deliberately *not* in this chapter.** The getting-started card
(`components/dashboard/GettingStartedCard.tsx`) has a step "place your first trade". That
is a **logic** change - which steps exist and when they count as complete - not a string
change, so it belongs with the onboarding work in `20` section 5. A wording pass that
merely relabels it leaves a new player on a games platform with a trading task.

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
> than stale (**R90**) - and the ladder **editor** able to replace a renamed twenty-rung ladder
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
