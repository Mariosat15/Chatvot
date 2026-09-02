# New Games Plan - ChartVolt Multi-Game Platform

**Status:** PLAN ONLY. No code has been changed. This folder is the design record to execute from later.
**Date:** 2026-08-17
**Goal:** Turn ChartVolt from a trading-only competition app into a **games platform** where trading is one game type among many (Trivia first), with points, leaderboards, badges, levels, achievements, prize distribution, admin management and wording all game-agnostic.

---

---

> ## SCENARIO DECIDED 2 SEPTEMBER 2026 - EXTERNAL GAMES ONLY
>
> The owner chose **external-only**: provider games are the only new games, and **no
> in-house game is built.** The active programme is `External game plans/` and its
> **X0-X12** phases. Start at `External game plans/PROGRESS.md`.
>
> **Stage 0 is unaffected** - it is a prerequisite in every scenario, it is the work
> currently in flight, and it is **X0** in the external programme. Keep using `00a`.
>
> **P1, the game-module foundation, is also unaffected in substance** - it is delivered as
> **X1**, from `External game plans/11-foundation-and-seams.md`.
>
> **P2, the in-house Trivia game, is not being built.** P3-P7 are delivered by
> `External game plans/12`-`16` instead. The chapters here remain valuable as analysis of
> the current codebase, and `15-platform-transformation-and-gaps.md` is still the record of
> the games-first direction.
>
> **The decision did not make the work smaller.** External-only is **23-30 weeks** against
> this folder's 14-19, because every platform-wide change is identical either way and the
> provider integration costs more than the in-house game it replaces. If any summary
> implies it was the cheaper option, it is wrong.

## IMPORTANT: two separate pieces of work

This folder describes **two deliveries, not one.**

| | Delivery | Status |
|---|---|---|
| **STAGE 0** | `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md` - two **pre-existing defects** fixed on their own | **Do first. Owner tests and signs off.** Still fully active |
| **NEW GAMES PLAN** | Everything else in this folder (Phases P1-P6) | **Superseded 2 Sep 2026** by the X-phases in `External game plans/`. P1 survives as X1; P2 is not being built |

Stage 0 is not games work. It fixes defects that exist in the application today and would be worth fixing even if no new game were ever added: competition entry paths that disagree about security and prize money, and admin/player model blueprints that have already drifted apart. They are separated out so they can be reviewed, deployed, tested and rolled back on their own.

Re-verifying those two defects on 1 September 2026 also turned up a live security hole - the simulator endpoints accepted a plain request header as authentication, so an unauthenticated caller could credit any wallet. It was fixed and pushed the same day (commit `d5d3a328`) and is recorded as **Prerequisite A** in `00a`.

**Do not begin Phase P1 until the owner has confirmed both Stage 0 fixes work in production.**

---

## Read in this order

| # | Document | What it answers |
|---|---|---|
| **00a** | **`00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`** | **The two prerequisite defects, their fixes, and the owner sign-off checklist** |
| 01 | `01-current-state-audit.md` | Exactly where trading is welded into the app, with file paths and line numbers |
| 02 | `02-target-architecture.md` | The Game Module contract, registry and the seams we cut |
| 03 | `03-data-model-changes.md` | Every schema change, field by field, including admin mirrors |
| 04 | `04-scoring-points-leaderboards.md` | How points, ranking, leaderboards and stats become game-agnostic |
| 05 | `05-prizes-money-layer.md` | Entry fees, prize pools, payouts, refunds - what is reused vs renamed |
| 06 | `06-gamification-xp-badges-journey.md` | XP, levels, badges, achievements, journey maps across games |
| 07 | `07-admin-panel-plan.md` | Admin sections, forms, stats dashboards, settings, RBAC |
| 08 | `08-user-ui-routes-plan.md` | Routes, navigation, components, dashboard, arena |
| 09 | `09-terminology-wording-plan.md` | How to de-trading the copy without a rewrite of 5,000 strings |
| 10 | `10-trivia-module-spec.md` | The first new game, specified end to end as the reference implementation |
| 11 | `11-infrastructure-jobs-flags.md` | Price feed, workers, feature flags, kill switches |
| 12 | `12-risk-register.md` | Every way this can break the app, with severity and mitigation |
| 13 | `13-migration-testing-rollout.md` | Data migration, backfill, test plan, rollout and rollback |
| 14 | `14-implementation-phases.md` | The step-by-step build order with acceptance criteria |
| **15** | **`15-platform-transformation-and-gaps.md`** | **Owner direction, 30 Aug 2026: games-first platform.** What chapters 01-14 already cover, the three gaps they do not (games catalogue as content, per-game marketplace, Game Master residuals), and why the visible catalogue is built last |

---

## The one-paragraph version

The platform already contains a **generic contest engine** (create -> join -> pay entry fee -> compete -> rank -> distribute prizes -> refund on cancel) and a **generic money layer** (credit wallet, ledger, platform fee, unclaimed pool, Game Master revenue share). Both are reusable for any game. What is trading-specific is: (a) the **participant performance record**, which stores capital/PnL/margin instead of a generic score; (b) the **ranking function**, which reads only trading metrics; (c) the **settlement step**, which closes forex positions at live prices; (d) the **always-on price feed**; and (e) roughly **5,000 hard-coded English strings** that say "trader" and "trading". The plan is therefore **not a rewrite**. It is: add a `gameType` discriminator, introduce a Game Module registry with one adapter per game, cut four precise seams so the shared engine calls the adapter instead of trading code, add a generic points/score field alongside the existing trading fields, and introduce a terminology layer so wording is data rather than code.

---

## Key decisions this plan commits to

| # | Decision | Why |
|---|---|---|
| D1 | **Add `gameType`, do not remove trading fields** | Additive schema change is backward compatible. Existing competitions keep working with zero data migration risk. |
| D2 | **Adapter/registry pattern (`lib/games/`), not inheritance or separate collections** | One contest collection keeps leaderboards, wallet, admin lists, GM revenue and refunds working unchanged. Separate collections would fork every one of those. |
| D3 | **Generic `score` on the participant is the ranking currency** | `getRankingValue()` at `competition-ranking.service.ts:64` is a single function - the cheapest seam in the whole codebase. |
| D4 | **`tradingEnabled` master flag copying the `arenaEnabled` pattern** | That pattern already exists and touches only 8 files. Proven, reviewable, reversible. |
| D5 | **Gate trading infrastructure, never delete it** | The price streamer, workers and websocket server are the highest-risk code to remove and the cheapest to leave idle. |
| D6 | **Terminology tokens with DB overrides, not full i18n** | There is no i18n layer today. Introducing one for 5,000 strings is a project on its own. A token dictionary for the ~150 shared-shell strings gets 90% of the benefit. |
| D7 | **Trivia is built as a plugin against the contract, not as a special case** | If Trivia needs a code change outside `lib/games/trivia/`, the contract is wrong and we fix the contract. This is the test that the abstraction actually works. |
| D8 | **Points are normalised per game so cross-game leaderboards are fair** | Raw trading PnL (thousands) and trivia score (tens) cannot share a column. See `04`. |
| D9 | **The two pre-existing defects are fixed and signed off as a separate delivery (Stage 0)** | They are not games work, they are independently valuable and independently testable, and they are the foundation everything else stands on. Bundling bug fixes inside a feature release makes both harder to review and harder to roll back. |

---

## Verified starting facts

These were confirmed directly against the codebase, not assumed:

- **Zero occurrences** of `gameType`, `activityType`, `game_type`, `activity_type` or `tradingEnabled` in any `.ts`/`.tsx` file. There is no game abstraction and no trading master switch today.
- **`arenaEnabled`** - the flag pattern to copy - lives in exactly 8 files: the two `whitelabel.model.ts` copies plus its `.d.ts`, `app/api/settings/route.ts`, `apps/admin/app/api/environment/route.ts`, `apps/admin/components/admin/EnvironmentSection.tsx`, `components/UserSidebar.tsx`, `app/arena/layout.tsx`.
- **`getRankingValue()`** at `lib/services/competition-ranking.service.ts:64` is a single `switch` over six trading metrics (`pnl`, `roi`, `total_capital`, `win_rate`, `total_wins`, `profit_factor`). This is the primary seam.
- **No i18n layer exists.** No `next-intl`, `react-i18next` or `useTranslation` anywhere. All copy is hard-coded English or English DB content.
- **The admin app mirrors 75 model files, 19 action files and 51 service files.** Every schema change must be applied twice or the two apps disagree at runtime. **This has already gone wrong:** 10 mirrored model pairs have real field drift today, including `gameMasterId` and `gameMasterName` (competition), `provider` and `providerTransactionId` (wallet transaction), and `brandingFiles` (whitelabel). `platform-financials.model.ts` drifts in *both* directions, which fails writes rather than merely hiding fields. Models are fixed in Stage 0; the duplicated actions and services are recorded as a known risk, not in scope.
- **Four competition entry paths disagree on money**: the server action increments `prizePool`, the API route and `join-batch` do not, and the admin mirror omits two security checks. Confirmed in `competition.actions.ts` lines 584-593 versus `join/route.ts` lines 252-256. The API route is currently reached only by the simulator, and the finalize-time safeguard does **not** correct an under-counted pool. The challenge *accept* path, which real players do use, skips account restrictions and the fraud gate. All fixed in Stage 0.
- **Trading jobs already no-op** when there are no active contests, which means switching trading off is far safer than expected.

---

## Effort and sequencing at a glance

Estimates assume one experienced full-stack developer who knows this codebase, and include testing. They are ranges because the wording work is open-ended.

| Phase | Scope | Estimate |
|---|---|---|
| **STAGE 0** | **Separate delivery, owner sign-off required.** Consolidate the two join paths, fix the prize-pool defect, sync the drifted model mirrors, add the CI mirror guard and the money tests | **5 - 8 days** |
| P1 | Foundation: `gameType`, `gameConfig`, generic `score`, Game Module registry, ranking seam, trading adapter wrapping current behaviour, **`gameType` on both Game Master competition inserts - a gate, see `15` s5** | 2.5 - 3.5 weeks |
| P2 | Trivia module: content model, gameplay API, scoring, settlement, play route | 2 - 3 weeks |
| P3 | Admin: game-type-aware create/edit/list, Trivia settings section, stats by game type | 1.5 - 2 weeks |
| P4 | Gamification: per-game points, leaderboards, badges scoped by game, XP events, journey conditions, **Game Master creation API and per-game earnings analytics** | 3 - 4 weeks |
| P5 | Terminology and UI shell de-trading, `tradingEnabled` master flag, infra gating, **Game Master wizard and tier wording** | 2 - 2.5 weeks |
| P6 | Hardening: migration backfill, load test, rollout, rollback rehearsal | 1 week |
| P7 | Games-first navigation: `GameCatalogueEntry` model, admin catalogue editor, `/games`, `/games/[slug]`, merchandising. See `15`. **Deliberately last** - a catalogue holding one non-trading game advertises an empty platform | ~2 weeks |

**Stage 0: 6 to 9 days, delivered and signed off separately.** Started 1 September 2026. One unplanned item within it, a simulator authentication fix, has already shipped as commit `d5d3a328`.
**New Games Plan (P1-P7): roughly 14 to 19 weeks** of focused work to a production Trivia launch with trading switchable and a games catalogue in front of it.

> **Revised 30 Aug 2026 from 12 to 17 weeks.** Game Master work was listed as a deferred
> residual of about four days. Read against the code it is **~2.5 weeks** and part of the
> programme, with its first piece a gate inside P1. See `15` section 5.

P1 is the phase that must be done most carefully; everything after it is additive and individually shippable. If time is short, P1-P3 alone (8 to 10 weeks) delivers a Trivia contest that can be created, played and paid.

**Be honest about the total.** Stage 0 plus P1-P7 plus the deferred per-game marketplace in `15` is close to six months of one developer. That is the real cost of the full games-first platform, and it does not have to be committed in one block. **Scope, not technical difficulty, is the main risk to this programme.**

---

## The danger summary

Full detail is in `12-risk-register.md`. The five things most likely to break the app:

1. **Touching the money paths without tests first.** Entry fee debit, prize payout and refunds have two divergent code paths for competitions and a confirmed prize-pool defect. Refactoring these before writing tests risks double-charging or unpaid winners. **Handled in Stage 0, before any games work.**
2. **Forgetting the admin mirror.** 75 duplicated model files. A schema field added in one app and not the other means the other app **cannot write that field** - silently, while reporting success - and a missing *enum value* rejects the write outright. (Measured 1 Sep 2026: drift is write-side. Reads are unaffected and an ordinary `save()` preserves everything, contrary to what these documents used to say.) **This has already happened** - 11 pairs were out of sync. **Fixed in Stage 0**, with `npm run check:mirrors` in CI and on `git push` so it cannot recur.
3. **Letting trading settlement run against non-trading contests.** `competition-end.actions.ts` closes forex positions and recalculates PnL. Pointed at a Trivia contest it would produce zero scores and pay the wrong winners. The settlement step must dispatch on `gameType` before anything else.
4. **Gutting the always-on price infrastructure.** It self-starts from a module import, so its startup is implicit. Gate it behind a flag; do not remove it.
5. **Bulk find-and-replace on wording.** Thousands of matches, and the strings overlap with database enum values, API routes and CSS class names. Wording must be done through a terminology layer and reviewed screen by screen, never by regex.
