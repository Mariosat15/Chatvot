# 07 - Admin Panel Plan

The admin is a single-page app driven by a `menuGroups` config plus a `renderContent()` switch in `apps/admin/components/admin/AdminDashboard.tsx` (~60 sections). This is actually a **convenient** architecture for this project: adding a section is a config entry plus a switch case, not a routing change.

---

## 1. Navigation restructure

### Current problem

There is a nav group literally named **"Trading"** containing: Competitions, 1v1 Challenges, Trading History, Analytics, Market Hours, Trading Symbols, Market Data. Once Trivia exists, Competitions no longer belongs under "Trading".

### Target structure

```
COMPETITIONS                      <- renamed from "Trading"
  Competitions                    (all game types, with a game filter)
  1v1 Challenges                  (all game types)
  Contest Analytics               (renamed from "Analytics", game-filterable)
  Game Types                      <- NEW: registry view, enable/disable, per-game settings

TRADING                           <- NEW group: trading-only operational tools
  Trading History
  Market Hours
  Trading Symbols
  Market Data
  Trading Risk                    (moved from Settings)
  Price Feed Health               (moved from Operations)

TRIVIA                            <- NEW group, appears only when trivia is enabled
  Question Bank
  Categories
  Trivia Settings
```

The whole `TRADING` group should be **hidden when `tradingEnabled === false`**, and each game group hidden when that game is not in `enabledGameTypes`. This is the same conditional-visibility pattern `UserSidebar.tsx` already uses for `arenaEnabled`.

### RBAC - do not forget this

`ADMIN_SECTIONS` in `apps/admin/database/models/admin-employee.model.ts` is the permission registry. The audit found several existing menu IDs are **missing** from it (`journey-map`, `gamification-wizard`, `system-announcements`, `vendors`, `mdb-cluster`, `server-fleet`, `data-cleanup`, `data-maintenance`), meaning employees cannot be granted them - only super admins see them.

Every new section ID (`game-types`, `trivia-questions`, `trivia-categories`, `trivia-settings`) **must** be added to `ADMIN_SECTIONS`, or the same bug is reproduced. Worth fixing the existing eight omissions in the same pass since it is a one-line change each.

---

## 2. Competition create/edit - the biggest UI change

### Current

7-step wizard in `CompetitionCreatorForm.tsx`: Basic Info -> Financial -> Schedule -> **Trading** -> Prizes -> Rules -> Launch.

Step 4 is entirely trading (asset classes, leverage slider, risk limits, equity check). Step 6's ranking methods are the six trading metrics.

Also noted: the **edit** form (`CompetitionEditorForm.tsx`) exposes fewer fields than create - no risk limits, no rules, no ranking method. That inconsistency should be resolved rather than propagated to game configs.

### Target

Insert a **game type picker as step 1** (or as the first field of Basic Info), then make step 4 and step 6 dynamic:

```
Step 1  Game Type        <- NEW. Cards from listGameModules(), filtered by enabledGameTypes.
                            Locked after creation (see below).
Step 2  Basic Info       unchanged
Step 3  Financial        unchanged (entry fee, participants, platform fee)
                         "Starting capital" moves into the game config step
Step 4  Schedule         unchanged
Step 5  Game Settings    <- DYNAMIC: renders the module's config form
                            trading -> today's step 4 exactly
                            trivia  -> category, question count, seconds/question,
                                       difficulty mix, shuffle, min questions to qualify
Step 6  Prizes           unchanged
Step 7  Rules            ranking method + tie-breakers populated from
                         module.rankingMethods(); qualification field is game-specific
Step 8  Launch           review, showing the game type prominently
```

### Implementation approach for the dynamic step

Two options:

| Option | Pros | Cons |
|---|---|---|
| **A. Per-module React config component**, registered in an admin-side game registry | Full control, good UX, validation inline | Requires an admin mirror of the games registry; each game ships a form component |
| **B. Schema-driven form** - module exposes a JSON field descriptor list, admin renders generically | One renderer, new games need no admin code | Weaker UX for anything non-trivial (the trading leverage slider bounded by platform risk settings would be awkward) |

**Recommendation: A**, because the trading config form already exists and is non-trivial - forcing it through a generic renderer would be a rewrite with no benefit. Register admin config components in `apps/admin/lib/games/registry.tsx`.

### Game type is immutable after creation

Once a contest has participants, changing its game type is meaningless and dangerous (participants hold game-specific state, and the settle path would change under them). Enforce:
- UI: picker disabled in the edit form, shown as a read-only badge.
- Server: reject `gameType` changes in the update route if the contest is not `draft` with zero participants.

---

## 3. Contest list and detail screens

`CompetitionsListSection.tsx` and `ChallengesAdminSection.tsx`:

- Add a **game type column** and a **game type filter**.
- Show game-appropriate summary columns. Today the list/detail show PnL and trade counts; those must become module-declared columns (a Trivia contest shows top score and average accuracy instead).
- `apps/admin/app/competitions/view/[id]/page.tsx` renders a leaderboard with PnL/rank/trades - drive its columns from `module.statDescriptors()`.

Admin lifecycle actions (cancel, pause/resume, emergency-cancel, adjust-results, force-finalize) are game-neutral in intent, but two need attention:

| Action | Route | Game consideration |
|---|---|---|
| Emergency cancel | `.../emergency-cancel` | Currently closes open positions using a price snapshot. Must dispatch to `module.settleContest()` instead, or skip position closing for non-trading games. |
| Adjust results | `.../adjust-results` | Manual rank override. Must write `score` and recompute `normalizedPoints`, not just trading fields. |
| Force-finalize old | `/api/finalize-old-competitions` | Must be game-aware or it will run trading settlement on Trivia contests. **This is risk R3.** |

---

## 4. New admin section: Game Types

A registry view - low effort, high operational value:

- Lists every registered module: id, label, description, capabilities, enabled toggle.
- Toggling writes `enabledGameTypes` on `WhiteLabel`.
- Shows, per game: active contests, participants today, GMV this month, average fill rate. Answers "is this game worth keeping?"
- Warns before disabling a game that has active contests (they must be allowed to finish - disabling should prevent *new* contests, not break running ones). This distinction must be explicit in the code, not just the copy.

---

## 5. New admin sections: Trivia

### Question Bank

Full CRUD over `TriviaQuestion`:
- Fields: prompt, 2-6 options, correct index, category, difficulty (1-5), explanation, optional media URL, tags, active flag.
- Bulk CSV/JSON import - essential; hand-entering a few thousand questions through a form is not viable.
- Duplicate detection on prompt text (fuzzy) to avoid the same question appearing twice in one contest.
- Per-question stats: times served, correct rate. A question answered correctly 99% of the time is not discriminating and should be retired; one at 5% is probably wrong or mis-keyed. This is the quality-control loop that keeps the game fair.
- Review queue for AI-generated questions. The platform already has OpenAI integration and AI generators for competitions, badges and journeys, so generating question drafts is a natural reuse - but generated questions **must** be human-approved before going live, because a wrong answer key in a paid contest is a refund event and a trust problem.

### Categories

CRUD over `TriviaCategory`: name, slug, icon, description, active, question count. Simple.

### Trivia Settings

Singleton defaults: default question count, seconds per question, base points, speed bonus max, streak bonus curve, min questions to qualify, shuffle options on/off, allow skip, review-answers-after-contest on/off.

---

## 6. Stats and analytics

| Screen | Change |
|---|---|
| `AdminOverviewDashboard.tsx` | Add per-game active contests + participants. Keep price-feed health visible only when trading is enabled. |
| `CompetitionAnalytics.tsx` | Add game filter. Currently shows winner PnL / total trades / disqualified - make those columns module-declared. Add participation funnel by game (created -> filled -> started -> completed). |
| `FinancialDashboard.tsx` | Add GMV / fee revenue / payout ratio **by game type** (see `05` section 5). This is the key business metric the strategic review asked for. |
| `TradingHistorySection.tsx` | Leave as-is - genuinely trading-specific. Hide when trading disabled. |
| `PriceHealthWidget.tsx` | Hide when trading disabled. |
| Fraud monitoring | Extend behavioural signals to non-trading entries (see `12`, R9). |
| New: Game Performance | Per game: entries, unique players, retention, avg entry fee, fill rate, tie frequency, dispute count. |

---

## 7. Settings that need a game dimension

| Setting | Current model | Change |
|---|---|---|
| Competition Rules defaults | `CompetitionRules` singleton | Per-game defaults, or leave as trading defaults and add per-game defaults in the module. Prefer the latter - keeps the singleton meaningful. |
| Challenge Settings | `ChallengeSettings` singleton | Add `gameTypeDefaults` + `enabledChallengeGameTypes` (see `03`) |
| Market Hours | `MarketSettings` | `blockCompetitionsOnHolidays` / `blockChallengesOnHolidays` currently apply to **all** contests via forex checks. Must apply only to games where `capabilities.needsMarketHours` is true, or Trivia will be blocked on Christmas for no reason. |
| Trading Risk | `TradingRiskSettings` | Unchanged, trading-only. Move under the TRADING nav group. |
| Points/normalisation constants | new | New `PointsSettings` for the `04` formula constants so they are tunable without deploy |
| Environment | `WhiteLabel` | Add `tradingEnabled`, `enabledGameTypes` toggles to `EnvironmentSection.tsx` |

The market-hours item is a real trap: it is a setting that silently changes behaviour for a game that has nothing to do with markets.

---

## 8. Content and copy in admin

Admin-managed content that carries trading wording (all DB-backed, so these are **data** tasks, not code):

- `HeroSettings` (landing): feature cards "Trading Competitions", stats "Active Traders", "Trades Executed", footer risk disclaimer, enterprise copy "Launch Your Own Trading Platform".
- `SitePage` legal pages: ToS describing a "trading competition platform" - **needs legal review**, not just a find-and-replace, since these are contractual documents.
- Email templates: `competition_starting`, `competition_ended`, `margin_warning`, `challenge_received`, plus legacy stock-app leftovers (`PRICE_ALERT`, `STOCK_ALERT`, `VOLUME_ALERT`) which look like dead code worth deleting.
- Notification templates: bodies referencing trades and `/trade` URLs. The URL is functional, not cosmetic - a Trivia notification linking to `/trade` is a broken link, so this one is a bug not just wording.
- Badge and milestone content per `06`.

---

## 9. Effort estimate

| Task | Estimate |
|---|---|
| Nav restructure + conditional groups + RBAC registry | 2 days |
| Game type picker + dynamic config step in create wizard | 4 days |
| Edit form parity + immutable game type enforcement | 2 days |
| List/detail game columns + filters | 2 days |
| Game Types registry section | 2 days |
| Trivia Question Bank (CRUD + import + stats) | 5 days |
| Trivia Categories + Settings | 2 days |
| Analytics by game type | 4 days |
| Financial dashboard by game type | 3 days |
| Settings adjustments (market hours scoping, points settings) | 2 days |
| **Total** | **~28 days (5.5 weeks)**, matching the P3 + part of P4 allocation |

---

## 10. Admin acceptance criteria

- An admin can create, monitor, finalize and cancel a Trivia competition without touching any trading field.
- An admin can create a trading competition and the flow is **identical** to today.
- Turning `tradingEnabled` off hides the TRADING group and blocks creation of trading contests, while any running trading contests finish normally.
- Financial and contest analytics can be filtered by game type.
- An employee (non-super-admin) can be granted the new sections via role templates.
