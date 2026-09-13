# 09 - Terminology and Wording Plan

The brief asks that "wording must be around competitions rather than only trading". This is the task most likely to be done badly, because the obvious approach - find and replace across the repo - would break the application. This document defines a safe approach.

---

## 1. Why bulk replace is dangerous

The grep counts (roughly 5,000 matches for trading terms) include four categories that look identical to a regex but must be treated completely differently:

| Category | Example | Safe to change? |
|---|---|---|
| **User-visible label** | `<h3>Total Trades</h3>` | Yes - this is the target |
| **Identifier / API surface** | `/api/trading/prices`, `TradingPosition`, `competition_entry`, `canTrade`, `rankingMethod: "pnl"` | **No** - renaming breaks routes, DB enums, ledger history, admin filters |
| **Log / internal string** | `console.log("Trading positions closed")` | Pointless to change; costs review time |
| **CSS / asset name** | `trading-panel`, `chart-toolbar` | No user impact |

A regex cannot distinguish these. A replace-all over `"Trader"` would rename the `traderId` field, the `TraderLevel` type, the `/trader` route and the `Trader` badge ID along with the label. Some breakages would be caught by TypeScript; DB enum values and API paths would not, and would fail only at runtime, in production, in the payment and ranking paths.

**Rule: no bulk find-and-replace. Wording changes go through the terminology layer or are made screen by screen with review.**

---

## 2. Scope: what actually needs to change

Of the ~5,000 matches, the genuinely user-visible strings in the **shared shell** (the parts every player sees regardless of game) number roughly **150-250**. That is the real scope of the wording project.

Everything else falls into:
- **Trading-only screens** (`/trade`, chart stack, trading help guide, trading arsenal): these **should keep** trading language. They are the trading game. Neutralising them would be actively worse - a trader wants to see "P&L", not "Score".
- **Identifiers**: leave alone.
- **DB content** (badges, milestones, landing copy, email/notification bodies): edited through the admin panel as data, not code.

Framing it this way turns an intimidating 5,000-string problem into a 200-string problem plus some admin data entry.

---

## 3. The terminology layer

No i18n exists (confirmed: no `next-intl`, `react-i18next`, `useTranslation`). Rather than introduce full i18n for a single language, introduce a **token dictionary** with DB overrides.

### Token catalogue

`lib/constants/terminology.ts`:

```ts
export const TERMS = {
  // actor
  player:            "Player",
  players:           "Players",
  playerPossessive:  "Player's",

  // activity
  // Reason: token names match the codebase - Challenge model, /challenges routes,
  // challengesEnabled, challenge_entry. Never introduce "duel" as a synonym.
  contest:           "Competition",
  contests:          "Competitions",
  challenge:         "Challenge",
  challenges:        "Challenges",
  navSectionCompete: "Compete",

  // performance
  score:             "Score",
  points:            "Points",
  rating:            "Rating",
  rank:              "Rank",
  leaderboard:       "Leaderboard",

  // progression
  level:             "Level",
  levelTitle:        "Title",
  badge:             "Badge",
  journey:           "Journey",

  // money (already neutral, listed for completeness)
  credits:           "Credits",
  prizePool:         "Prize Pool",
  entryFee:          "Entry Fee",
} as const;

export type TerminologyPack = typeof TERMS;
```

### Resolution order

```
per-game override (module.terminology)
  -> DB override (WhiteLabel.terminologyOverrides)
    -> default TERMS
```

Per-game overrides let the trading module keep its vocabulary inside its own screens - it maps `player -> "Trader"`, `score -> "P&L"` - while Trivia maps `player -> "Player"`, `score -> "Score"`. The **shared shell** uses the neutral defaults. This is what lets both games feel native without forking the shell.

### Access

- Server: `getTerms(gameType?)`
- Client: `useTerms(gameType?)` reading from the existing `AppSettingsProvider` (which already delivers `/api/settings`, so no new fetch and no new provider).

The `AppSettingsProvider` already carries currency and credits naming from `AppSettings`, so there is an established precedent for "wording as configuration" in this codebase. This extends it rather than inventing a pattern.

---

## 4. Migration order for strings

Do this in passes, each independently shippable and reviewable:

| Pass | Scope | Approx. strings |
|---|---|---|
| 1 | Navigation: sidebar section header, mobile nav, user name fallback "Trader" | ~10 |
| 2 | Level titles via `XPConfig` DB (see `06`) - **data change, no code** | 20 |
| 3 | Contest shell components moved to `components/contest/` (cards, lobby, countdown, entry, status) | ~50 |
| 4 | Leaderboard shared columns and headings | ~25 |
| 5 | Dashboard game-agnostic header and section titles | ~30 |
| 6 | Profile shared tabs and headings | ~30 |
| 7 | Notification + email template bodies (DB, admin) | ~25 templates |
| 8 | Badge/milestone content for generic achievements (DB, admin) | data |
| 9 | Landing/hero copy (DB, admin) | data |
| 10 | Help centre core sections | ~40 |
| 11 | Legal pages - **legal review required** | separate track |

Passes 2, 7, 8 and 9 are **data entry in the admin panel** and need no deploy. That is roughly half the perceived work, and it can be done by someone who is not a developer.

---

## 5. Specific high-visibility strings

| Location | Current | Proposed |
|---|---|---|
| `components/UserSidebar.tsx` section header | "Trading" | "Compete" |
| `UserSidebar.tsx` / `UserDropdown.tsx` name fallback | "Trader" | "Player" |
| `/api/user/level` default title | "Trader" | "Player" |
| `lib/constants/levels.ts` 20 titles | "Novice Trader".."Trading God" | neutral ladder (`06` section 3) |
| `app/layout.tsx` metadata | "Live Market competition Trading Platform" | platform-level description |
| `LiveStatsBar` | "Active Traders" | "Active Players" |
| Landing feature card | "Trading Competitions" | "Skill Competitions" (with trading as one) |
| Marketplace | "Trading Arsenal" | keep for trading items; the page itself becomes game-scoped |
| `/help` headings | "Trader's Journey", "Trader Levels" | "Your Journey", "Levels" |
| Journey default map name | "Trader's Journey" | "Your Journey" + per-branch names |
| Arena banner | "LIVE TRADING BROADCAST" | keep (it *is* the trading broadcast) |

---

## 6. What deliberately keeps trading language

Stating this explicitly so nobody "finishes the job" by neutralising these:

- Everything under `/competitions/[id]/trade` and `/challenges/[id]/trade`
- All of `components/trading/` that remains after the shared components move out
- The trading help guide and `/help/competitions` trading content
- `lib/constants/trading-terms.ts` tooltip glossary (balance, equity, pips, margin) - these are correct financial definitions
- Trading-specific notifications: `order_placed`, `position_opened`, `margin_warning`, `margin_call`, `liquidation`
- Admin TRADING nav group and its sections
- Trading badge names and trading journey branch

A trader should not notice this project happened. That is the acceptance criterion.

---

## 7. Things that must not be renamed

Hard list, for the PR checklist:

- API routes: `/api/trading/*`, `/api/competitions/*`, `/api/challenges/*`
- Collection and model names: `TradingPosition`, `TradeHistory`, `CompetitionParticipant`
- Ledger enum values: `competition_entry`, `competition_win`, `challenge_entry`, ... (see `05`)
- Ranking method IDs: `pnl`, `roi`, `total_capital`, `win_rate`, `total_wins`, `profit_factor`
- Restriction keys: `canTrade`, `canEnterCompetitions`, `canEnterChallenges`
- Status values: `liquidated`, `disqualified`, `completed`, `refunded`
- Badge and milestone **IDs** (labels can change, IDs cannot - renaming orphans user progress)
- Notification template **type keys**
- Env var names and settings keys

Because badge and milestone IDs are user-progress keys, changing them silently deletes achievements. Same class of problem as ledger enums.

---

## 8. Enforcement

Two cheap guardrails worth adding:

1. **ESLint rule / CI grep** flagging new hard-coded occurrences of "Trader"/"Trading" in `components/contest/`, `components/dashboard/` header components, and `components/leaderboard/`. Keeps the shared shell neutral as new code is written, which is the part that decays fastest.
2. **A terminology audit checklist** in the PR template for any UI change touching shared components.

Neither is expensive; both prevent regression, which is the usual fate of wording work.

---

## 9. Effort

| Item | Estimate |
|---|---|
| Terminology layer (tokens, resolution, hooks, DB field, admin UI) | 3 days |
| Passes 1, 3, 4, 5, 6 (code strings, ~145) | 5 days |
| Passes 2, 7, 8, 9 (admin data entry) | 3 days, non-developer |
| Pass 10 (help restructure) | counted in `08` |
| Pass 11 (legal) | external, track separately |
| Guardrails (lint rule, checklist) | 1 day |
| **Total code effort** | **~9 days** |

The insight worth carrying: this looked like the biggest task in the project and it is one of the smaller ones, provided nobody runs a global replace.
