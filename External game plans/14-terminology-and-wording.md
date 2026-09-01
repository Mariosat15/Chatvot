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

### Why per-game overrides matter more here

With provider games the vocabulary varies by title in ways an in-house plan would not
have to handle: a chess contest has "puzzles solved", a trivia game has "questions", a
time-attack has "best time". The per-game override layer is what lets each contest read
naturally without a code change per title - and it should be populated from the
provider's own catalogue metadata where possible.

---

## 3. Migration passes

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

---

## 8. Effort

| Item | Estimate |
|---|---|
| Terminology layer - tokens, resolution, hook, database field, admin UI | 3 days |
| Passes 1, 3, 4, 5, 6 - roughly 145 code strings | 5 days |
| Passes 2, 7, 8, 9 - admin data entry | 3 days, **non-developer** |
| Per-game overrides populated from provider catalogue metadata | 1 day |
| Guardrails - lint rule and checklist | 1 day |
| **Total engineering** | **~10 days** |

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
