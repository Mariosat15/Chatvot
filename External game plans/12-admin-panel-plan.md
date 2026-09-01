# 12 - Admin Panel Plan (part of X6)

`09` section E5 covers the **provider-specific** admin screens: provider list, health,
catalogue sync, round inspector, manual resolution. This chapter covers everything else
the admin panel needs before it can run a platform with more than one kind of game.

That work exists whether the games come from inside or outside. It was previously
delegated to `New games plan` chapter `07`; in the external-only scenario it belongs
here.

---

## 1. Navigation restructure

`apps/admin/components/admin/AdminDashboard.tsx` holds a `menuGroups` configuration and
a `renderContent()` switch covering roughly **60 sections**. Trading-specific and
generic sections are interleaved, so there is no way to hide trading.

### Target grouping

| Group | Contents | Visibility |
|---|---|---|
| **CONTESTS** | Competitions, challenges, participants, results, refunds | Always |
| **GAMES** | Game catalogue (`16`), game types registry, providers, provider health, round inspector | Always |
| **TRADING** | Symbols, market hours, trading risk, price health, trading history, arsenal | Hidden when `tradingEnabled === false` |
| **PLAYERS** | Users, KYC, restrictions, fraud, messaging | Always |
| **MONEY** | Wallet, transactions, financials, payouts, Game Masters | Always |
| **PLATFORM** | Settings, environment, content, wiki, employees | Always |

Use the same conditional-visibility pattern `components/UserSidebar.tsx` already uses
for `arenaEnabled`. Do not invent a second mechanism.

### RBAC - do not forget this

`ADMIN_SECTIONS` in `apps/admin/database/models/admin-employee.model.ts` is the
permission registry. A section not listed there **cannot be granted to an employee**,
so a new screen is invisible to everyone but a super-admin.

**Eight existing sections are already missing** and should be fixed in the same pass:
`journey-map`, `gamification-wizard`, `system-announcements`, `vendors`, `mdb-cluster`,
`server-fleet`, `data-cleanup`, `data-maintenance`.

**New IDs to add:** `game-catalogue`, `game-types`, `game-providers`,
`provider-health`, `round-inspector`.

This is risk **R22** in `17` - low severity, high likelihood, and trivial to prevent.

---

## 2. Competition create and edit - the biggest UI change

`CompetitionCreatorForm.tsx` is a seven-step wizard: Basic Info, Financial, Schedule,
**Trading**, Prizes, Rules, Launch. Step four is hard-coded trading configuration.

### Target

1. **Basic Info** - now includes a **game picker**, populated from
   `listGameModules()` filtered by what is enabled
2. Financial
3. Schedule - plus the **play window** and **grace period** for provider games (`03`)
4. **Game settings** - dynamic, replacing the fixed Trading step
5. Prizes - ranking methods from `module.rankingMethods()`
6. Rules
7. Launch - plus **pre-flight validation** from `03` section 4.1

### How the dynamic step works for provider games

This is where `configSchema` from `01` section 3 pays for itself. The provider declares
each game's settings as JSON Schema; the admin form is **generated from it**. A new
title from an existing provider becomes bookable by ticking a box, with no release.

For trading, keep a hand-written config component registered in
`apps/admin/lib/games/registry.tsx`. Trading's settings are too specific to be worth
schematising, and there is exactly one of them.

### Game type is immutable after creation

The UI must disable the picker on edit, and **the server must reject a change** unless
the contest is still `draft` with zero participants. Changing the game type of a live
contest means participants hold scores in units the settlement code will not understand.

`CompetitionEditorForm.tsx` currently exposes fewer fields than the create form - no
risk limits, no rules, no ranking method. Close that gap or the game settings will be
uneditable after creation.

---

## 3. Contest list and detail screens

| Screen | Change |
|---|---|
| `CompetitionsListSection.tsx` | Game column, game filter, provider column for provider contests |
| `ChallengesAdminSection.tsx` | Same |
| `apps/admin/app/competitions/view/[id]/page.tsx` | Leaderboard columns from `module.statDescriptors()` instead of hard-coded PnL and trade count. For provider contests: score, attempts used, round status, replay link |

### Lifecycle actions that must become game-aware

| Action | Route | Requirement |
|---|---|---|
| Emergency cancel | `.../emergency-cancel` | Dispatch to `module.settleContest()`, or skip position closing entirely |
| Adjust results | `.../adjust-results` | Write `score` and recompute normalised points, not trading metrics |
| Force-finalize old | `/api/finalize-old-competitions` | Must dispatch on game type - this is one of the five entry points in `11` section 2, and risk **R3** |

---

## 4. Provider-specific sections

Cross-reference only; the detail is in `09` E5 and `07`.

| Section | Purpose |
|---|---|
| Providers | List, credentials, enable/disable, catalogue sync, SLA notes |
| Provider health | Availability, callback latency, error rates, `provider_health_check` history |
| Games | Per-title enable switch **independent of the provider's own status** |
| Round inspector | Round status, score, raw inbound event, replay link, resolution history |
| Manual resolution | Resolve an unresolved round with a **mandatory reason** and an audit entry |

Every model touched here exists twice. Update `apps/admin/database/models/` in the same
commit - see risk **R2**.

---

## 5. Stats and analytics

| Screen | Change |
|---|---|
| `AdminOverviewDashboard.tsx` | Active contests and participants **per game**. Hide the price-feed panel when trading is off |
| `CompetitionAnalytics.tsx` | Game filter, module-declared columns, participation funnel |
| `FinancialDashboard.tsx` | Entry-fee volume, fee revenue, payout ratio and average pot **by game** - and by provider, since provider cost is per-provider |
| `TradingHistorySection.tsx` | Leave as-is. Hide when trading disabled |
| `PriceHealthWidget.tsx` | Hide when trading disabled |
| Fraud monitoring | Extend to non-trading entries - risk **R9** |
| **New: Game Performance** | Per-game operational metrics: rounds started versus completed, abandonment rate, unresolved-round count, average round duration, provider callback latency |

The Game Performance screen is the one that does not exist in the in-house plan, and it
is the one that will be looked at daily. **Rounds started versus rounds completed is the
single most useful number in the whole integration** - it detects a broken game, a
provider outage and a cheating pattern, all before players complain.

### The commercial question this must answer

Per-round provider cost against entry-fee revenue, per game. Without it there is no way
to tell whether a title is profitable or merely popular. Model it against `08` section 3
before launch, then measure it here.

---

## 6. Settings that need a game dimension

| Setting | Model | Change |
|---|---|---|
| Competition rules defaults | `CompetitionRules` | Per-game defaults come from the module |
| Challenge settings | `ChallengeSettings` | Add `gameTypeDefaults`, `enabledChallengeGameTypes` |
| Market hours | `MarketSettings` | **Scope `blockCompetitionsOnHolidays` and `blockChallengesOnHolidays` to games with `needsMarketHours`.** A forex holiday must never block a chess contest - risk **R10** |
| Trading risk | `TradingRiskSettings` | Unchanged; move under the TRADING group |
| Points normalisation | new `PointsSettings` | Per-game normalisation constants - `05` |
| Provider credentials | `WhiteLabel.gameProviders` | Per provider, with sandbox and production separated - `04` |
| Environment | `WhiteLabel` | Surface `tradingEnabled`, `enabledGameTypes`, `externalGamesEnabled` in `EnvironmentSection.tsx` |

**Disabling a game prevents new contests only.** Active contests must be allowed to
finish. The same rule applies to disabling a provider, and the admin UI should say so
explicitly rather than leaving an operator to guess.

---

## 7. Content and copy inside admin

| Item | Change |
|---|---|
| Email and notification templates | `competition_starting`, `competition_ended`, `challenge_received` need game-neutral wording. `margin_warning` stays trading-only |
| Template deep links | Several link to `/trade`. **For a provider contest that is a broken link** - risk **R23**. They must resolve through the play dispatcher in `13` |
| `SitePage` terms of service | Legal review, not find-and-replace - risk **R11** |
| Admin wiki | `AdminWikiSection.tsx` needs articles on running a provider contest, reading the round inspector, and resolving an unresolved round |

The wiki article on unresolved rounds is not optional. It is the runbook support will
need at the worst possible moment, and writing it after the first incident is too late.

---

## 8. Effort

| Task | Estimate |
|---|---|
| Navigation restructure, conditional groups, RBAC registry (including the 8 omissions) | 2 days |
| Game picker plus dynamic `configSchema`-driven settings step | 4 days |
| Edit form parity and immutable game type enforcement | 2 days |
| List and detail game columns, filters, module-declared leaderboard | 2 days |
| Provider, health, catalogue, round inspector, manual resolution (`09` E5) | 5 days |
| Analytics by game and provider, Game Performance screen | 4 days |
| Financial dashboard by game and provider, cost-versus-revenue | 3 days |
| Settings adjustments - market-hours scoping, points, credentials | 2 days |
| Notification and email template rework, admin wiki articles | 2 days |
| **Total** | **~26 days (~5 weeks)** |

Roughly half falls in **X6**; the analytics and financial parts can slip into **X7**
without blocking anything.

---

## 9. Acceptance criteria

- [ ] A provider contest is creatable end to end **without a single trading field
      appearing**
- [ ] A new provider title becomes bookable **with no code change** - the proof that
      `configSchema` works
- [ ] Trading contest creation is unchanged
- [ ] `tradingEnabled = false` hides the TRADING group, and running trading contests
      still finish correctly
- [ ] Analytics and financials filter by game **and by provider**
- [ ] An employee can be granted every new section
- [ ] An admin can resolve an unresolved round, with a reason recorded, without a
      developer
- [ ] A forex market holiday does not block a provider contest
