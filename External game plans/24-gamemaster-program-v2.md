# 24 - Game Master Program v2: private contests, Join GM, leaderboard, terms, admin reporting

**Status (30 September 2026): steps 0-5 BUILT (step 4 dark behind `gmJoinEnabled`; step 5's creation half dark behind `gmPrivateContestsEnabled`, its entry guard and discovery filters live); steps 6-8 are plan only.** This line
read "steps 0-4 BUILT" until step 5 shipped, and before that
read "PLAN ONLY ... Nothing in this chapter is built" until step 0 shipped - correct as
history, stale as a present fact.
Owner brief of 30 Sep 2026, sections 1-5 plus source tracking, filters, exports and the
"one central service" requirement. This chapter is the design; `19-game-masters.md`
remains the authoritative analysis of the system as it stands and must be amended as
each step lands (see s12).

---

## 0. What the code does today (verified, not assumed)

| Fact | Where | Consequence for this plan |
|---|---|---|
| A player is affiliated only at sign-up, through `?ref=` on `/sign-up` | `app/(auth)/sign-up/page.tsx:67`, `lib/actions/auth.actions.ts` ~L202-330 | Join GM is a **second writer** of the same relationship. It must not be a copy of this code - both go through one service (s3) |
| The relationship lives in `userreferrals` (unique `userId`) with a fallback copy on the `user` document (`referredByGameMasterId`) | `database/models/user-referral.model.ts` (mirrored) | Two stores already. The new service writes both, in that order, or neither |
| `UserReferral` has no source, no terms reference, and `referralCode` is **required** | same | A Join GM row must still carry the GM's current code; a `source` field is added |
| Settlement pays a GM only while `status: "active"` and not paused; otherwise the share is booked as `retained_gm_fee`; total GM payout is capped at the gross platform fee | `lib/services/settlement/game-master-fees/calculate.ts`, `fees.service.ts` | Join GM needs **no settlement change**: once the row exists, fees flow exactly as for a referral-link user |
| `Competition` has `gameMasterId` but **no visibility field anywhere** | `database/models/trading/competition.model.ts` ~L292 | Private contests are a new, mirrored, add-only field |
| Every paid entry goes through `enterContest`, with refusals before any wallet read | `lib/services/contest-entry.service.ts` L103-220 | The private-contest gate goes here, after the own-contest check and before the wallet read. This is the only place that can make it unbypassable |
| Package limits come from `marketplaceitems.gameMasterConfig`, resolved in code with defaults | `lib/services/gamemaster/subscription-limits.ts` (`GameMasterPackageConfig`), `package-config.ts` | Visibility permission is one more resolved limit, same precedence (override -> package -> cached -> default) |
| Action terms are `SitePage` rows with `category: "action_terms"`, acceptance in `TermsAcceptance` (slug, title, `termsUpdatedAt`) | `database/models/site-page.model.ts`, `terms-acceptance.model.ts`, `app/api/terms-acceptance/route.ts` | Reuse the mechanism; add a version id and GM context to the acceptance record |
| `GameMasterEarning.status` is `pending / paid / cancelled` | `database/models/gamemaster/gamemaster-earning.model.ts:133` | Admin "commission paid / pending" columns read this - no new money field |
| No CSV/XLSX library; six admin export routes hand-write CSV | `apps/admin/app/api/{transactions,invoices,trading-history,...}/export` | CSV follows the existing pattern; XLSX needs one new, verified dependency (s8) |
| `GameMasterManagementSection.tsx` is 758 lines | admin | Redesign must split it; nothing may be added to that file as it stands |

### 0.1 Pre-existing defects found while mapping (fix in step 0, before any feature)

These were not asked for. Each would make the new feature look broken while the new code is correct.

> **BUILT 30 Sep 2026 (step 0) - recorded as R116 in `17`.** All four are fixed, with 23
> tests in `__tests__/services/gm-referral-foundations.test.ts` and 7 of 8 probes red in
> `tools/probe-gm-program.ps1`. The eighth is recorded as unprobed with the reason. **Two
> deviations:**
> - The report-only script for stored `/register` links was not written. Every reader now
>   derives the link from `referralCode`, and a test forbids reading the stored field, so
>   the old values are inert.
> - Item 2 was confirmed by a behavioural test with an `_id`-only user, not against the
>   production database.
>
> Not retroactive, nothing backfilled.

1. **The stored referral link points to a page that does not exist.** `app/api/gamemaster/activate/route.ts:115` and `apps/admin/app/api/gamemaster/link/route.ts:104` build `/register?ref=`; the only route is `/sign-up` (no `/register` page, no rewrite). The GM's own dashboard builds `/sign-up?ref=` from `window.location`, so the GM sees a working link while the **admin screens show the stored one** (`GameMasterDashboardSection.tsx` L154-158, L389). Any GM who copied the link from an admin or an email lands on a 404 and the referral is lost silently. Fix: one `buildReferralLink(code)` helper, both writers use it, report-only script lists subscriptions with a stored `/register` link.
2. **User lookups by the `id` field** (the R68 shape - Better Auth keeps identity in `_id`). `sync-referrals/route.ts` L60 `findOne({ id: referral.userId })` and the settlement fallback in `buildReferralMap` (`user` collection `id: { $in }`). Verify against a real document first (probe with a user that has only `_id`); if confirmed, the fallback never matches and sync reports every user "not found". Fix with the `getUsersByIds` `$or` pattern and a behavioural test. **Money-adjacent: the fallback only matters when the `userreferrals` row is missing, so state the harm precisely after verifying.**
3. **A referral to a non-active GM is dropped silently at sign-up** (active-only lookup, failure never blocks sign-up). Keep the behaviour (it is correct not to attach a user to a suspended GM) but log it and count it, so "my link didn't work" is answerable.
4. `apps/admin/app/api/gamemaster/link/route.ts` returns `error.message` in 500s - replace with the generic message (one of the 166 recorded instances; only this file, since we touch it).

---

## 1. Decisions to confirm with the owner before building

Default in **bold** is what this plan assumes if not answered.

> **Owner answers, 30 Sep 2026:** D1 - the Join GM button is **greyed out and not clickable** for a user already affiliated to another GM; only an admin can reassign (the server still refuses, so a direct API call gets the same answer). D4 - **yes**, so the partial unique index in s2.1 is required. D6 - a GM sees **display name, email and country** of users who accepted the terms. Leaderboard earnings - **hidden; admin only**.

| # | Question | Default |
|---|---|---|
| D1 | May a user who is **already** affiliated to GM A join GM B via Join GM? | **No. Refused with the reason and the name of their current GM. Only an admin reassignment (existing tool, audited) can move them.** The brief says "cannot silently switch"; the safest reading is "cannot switch themselves at all" |
| D2 | May a user who signed up with **no** referral use Join GM later? | **Yes - that is the point of the feature** |
| D3 | May a user leave a GM? | **No self-service unaffiliation in v2** (it would let a user dodge a GM's commission on demand). Admin only |
| D4 | Is a user who was referred to a GM whose subscription later **expired** free to join another? | **Yes, if the old GM's subscription is expired/deleted (not merely paused or suspended).** The old row is kept with `isActive: false` and `endedReason`, a new row is created. This needs the unique index change in s2.1 |
| D5 | Private contest + already-entered player whose affiliation later ends | **Seat is kept. Eligibility is checked at entry only.** Removing a paid seat is a refund policy decision |
| D6 | Does a GM see affiliated users' contact info? | **Only what the terms say (s5), only for users who accepted those terms, and only in the GM dashboard - never in a public leaderboard.** Referral-link users who never accepted terms keep today's visibility |
| D7 | Who sees the GM leaderboard? | **Any signed-in player.** GMs with `isPaused`, suspended, or `scheduledForDeletion` are hidden from it and cannot be joined |
| D8 | Private challenges? | **Out of scope.** Challenges have no GM creator. Private applies to competitions only |

---

## 2. Data model (all add-only; both mirrors in the same commit; `npm run check:mirrors`)

> **BUILT 30 Sep 2026 (step 1).** Every field below exists and is **inert** - nothing reads it
> until steps 2-6. Live code: `lib/services/gamemaster/competition-visibility.ts` (mirrored,
> byte-identical test), `resolveAllowedVisibility` in both `subscription-limits.ts` copies, the
> models listed, and the migration in `lib/services/gamemaster/affiliation-migration.ts`
> (mirrored, byte-identical test), run from **Admin -> Game Masters -> Run migration** or from
> `tools/gamemaster/backfill-affiliation-source.ts` (**report-only until applied; not run
> against production**). The `-core.ts` file named here before 30 Sep 2026 was moved into that
> module, so the name is correct as history only. Tests: `__tests__/services/gm-program-data-model.test.ts`
> (24); probes 9-17 in `tools/probe-gm-program.ps1`, all red on exactly one test, plus one
> recorded as unprobed. **Deviations from the text below, recorded rather than absorbed:**
> - **`TermsAcceptance` is main-app only**, not mirrored: `apps/admin` has no copy and reads
>   nothing from the collection, and mirroring ahead of a caller is the R42 shape.
> - **The partial unique index is on `{ userId, isActive }`**, not `{ userId }`, named
>   `userId_active_unique`, plus a plain lookup `{ userId, referredAt: -1 }` replacing the old
>   one. The test proving it needs **two** ended rows: one ended plus one active differ on
>   `isActive` and pass an unfiltered index too, which a probe proved green.
> - **`required-indexes.ts` in the admin app would have rebuilt `userId_1`** from its
>   "create missing indexes" button and silently blocked D4 again. It now lists the new pair.
> - **`users/delete` handled one referral row** (`findOne` + `deleteOne`); with D4 a player can
>   hold several, so it now decrements each row's Game Master and deletes them all.
> - **`allowedVisibility` needs `default: undefined`** on every array path - Mongoose gives a
>   `[String]` path an implicit `[]`, which is the "empty array means configured" fact s2.3 says
>   must not exist.
> - **`SitePage.version` has no editor bump yet** - that is step 3.
> - **Two writers of `userreferrals` besides fixtures** (sign-up and the admin end-logic
>   harness); both now set `source: "gm_referral_link"` and `affiliatedVia.surface: "signup"`,
>   which is also what the backfill writes onto legacy rows.

### 2.1 `UserReferral` (mirrored)
- `source: "gm_referral_link" | "chartvolt_join_gm"` - **required on new writes, no schema default.** A default would make a pre-migration row indistinguishable from a real referral-link row (the `zeroIsValidResult` lesson). Backfill sets `gm_referral_link` on every existing row (s10).
- `termsAcceptanceId?: ObjectId`, `termsSlug?`, `termsVersion?` - set for Join GM; set for referral link too once the sign-up form shows the terms (s5.3).
- `affiliatedVia?: { competitionId?: string; surface: "leaderboard" | "private_contest" | "gm_profile" | "signup" }` - reporting only.
- `endedAt?`, `endedReason?: "gm_expired" | "gm_deleted" | "admin_reassigned"`.
- **Index change (only if D4 = yes):** replace unique `{ userId }` with a partial unique index `{ userId }` where `isActive: true`. Migration builds the new index first, then drops the old. If D4 = no, keep the index exactly as it is - it is the strongest double-affiliation guard we have.

### 2.2 `Competition` (mirrored)
- `visibility: "public" | "gm_private"`, **schema default `"public"`**. Here a default is right: every existing contest is public and must stay so.
- Only writable at creation, only by the GM creation routes; added to `NEVER_EDITABLE_FIELDS` in `competition-update-fields.ts` so no admin edit can flip a contest with paid seats between modes.
- Index `{ visibility: 1, status: 1 }`.

### 2.3 GM package + subscription limits
- `GameMasterPackageConfig.allowedVisibility?: ("public" | "gm_private")[]`; same field on `subscription.limits` (main-app model) and both package model copies.
- Resolver `resolveAllowedVisibility(limits)` in `subscription-limits.ts` (mirrored): **absent or empty array means `["public"]`** (the `resolveAllowedGameTypes` reading: an empty array is only ever an accident). Existing packages therefore behave exactly as today; the owner opts packages in from the package editor.
- `buildSubscriptionLimits` copies it (the single writer since R31), so "works for new and existing packages" is: new purchases copy it, and the resolver reads the **current package first** for existing subscriptions, as the fee percentage already does. No bulk rewrite of subscriptions.

### 2.4 `TermsAcceptance` (main app only as built - see the BUILT note above)
- `termsVersion` (string, from the page), `context?: { gameMasterId?: string; affiliationSource?: string; competitionId?: string }`.
- `SitePage` gains `version` (string, bumped by the admin editor on every content save of an `action_terms` page) - `termsUpdatedAt` alone is a timestamp, not an identity you can cite in a dispute.

### 2.5 Customer audit trail (admin model)
- New `AuditActionType` values: `gm_affiliation_created`, `gm_affiliation_refused`, `gm_affiliation_reassigned`, `gm_terms_accepted`; category `assignment`. Enum is add-only.

---

## 3. The one service: `lib/services/gamemaster/affiliation.service.ts`

> **BUILT 30 Sep 2026 (step 2) - read the code, not this section's table.** Live code:
> `lib/services/gamemaster/affiliation-rules.ts` (pure decision), `affiliation.service.ts`
> (`affiliate`, `getAffiliation`), and sign-up in `lib/actions/auth.actions.ts` now calls
> `affiliate({ channel: "gm_referral_link", surface: "signup" })`. Pinned by
> `__tests__/services/gm-affiliation-service.test.ts` (27 tests, real replica set) and
> probes 19-28 in `tools/probe-gm-program.ps1` (26 probes in all, each red on exactly one
> test; 13 was re-aimed because sign-up no longer writes `source` itself). **Six deviations
> from the plan below, each deliberate:**
> - **Neither module is mirrored yet.** Nothing in `apps/admin` calls them, and R42 is the
>   case that shows a mirror ahead of its caller is two copies agreeing while one runs. They
>   are mirrored in step 7 with the first admin caller.
> - **`canJoinGameMaster` is not a separate function.** The decision is `decideAffiliation`,
>   run *inside* the transaction against what it read there, because a pre-check outside it
>   is a second answer that can be stale by the time the insert runs.
> - **The input is `channel`, not `source`**, and `surface` (signup / leaderboard / private
>   contest) is stored under `affiliatedVia`. The GM is named by `referralCode` or
>   `subscriptionId`, never by a GM user id from the client.
> - **D4 is in the service**: a previous GM whose subscription is `expired` or has been
>   deleted frees the player - the old row is ended (`gm_expired` / `gm_deleted`) and its
>   `activeReferredUsers` decremented in the same transaction. **`cancelled` and
>   `suspended` still block** - they are reversible, and a move there is a way to dodge a
>   Game Master's commission. Only an administrator reassigns (D1).
> - **Joinability differs by channel.** The referral link needs only `status: "active"`, as
>   sign-up always did, so behaviour there is unchanged; Join GM also refuses a paused GM or
>   one scheduled for deletion.
> - **Terms codes, `canEnterPrivateContest`, the rate limit and the report rows are not
>   here yet** - steps 3, 5, 4 and 7. The transaction is a manual retry loop on E11000 and
>   transient conflicts (following `contest-entry.service.ts`), and the retry reads the
>   winner's row, so a race to one GM is idempotent and a race to two leaves exactly one.
>
> Audit: `gm_affiliation_created` / `gm_affiliation_refused` in `customer_audit_trail`,
> best-effort after commit, none on the idempotent repeat. The structural writer scan found
> a real blind spot while being built - a raw write through a *variable* holding the
> collection (`collection.updateMany`) is invisible to a chained-call regex - so it also
> flags any file that both names `"userreferrals"` and calls a write method, with named
> exceptions carrying reasons and a test that fails when an exception stops matching.

Main app, with a model-free rules module `lib/services/gamemaster/affiliation-rules.ts` **mirrored and pinned byte-identical** (the admin reporting needs the same eligibility answers). Every caller - sign-up, Join GM API, private-contest entry, leaderboard, admin reports - goes through it. Nothing else writes `userreferrals` or `user.referredByGameMasterId` (a structural test counts writers, s9).

| Function | Answers |
|---|---|
| `getAffiliation(userId)` | Active row or null. Reads `userreferrals` first, `user` fallback via the `$or` id pattern |
| `canJoinGameMaster(userId, gmSubscriptionId)` | `{ ok } \| { ok:false, code, message }` - codes: `self`, `already_affiliated_same`, `already_affiliated_other`, `gm_not_joinable` (not active / paused / suspended / scheduled for deletion), `user_restricted`, `terms_not_accepted`, `terms_outdated` |
| `affiliate({ userId, gmSubscriptionId, source, termsAcceptanceId?, context })` | Creates the relationship. **Atomic**: transaction inserts the `userreferrals` row (unique index is the race guard; E11000 on the same GM = idempotent success, on another GM = `already_affiliated_other`), sets the user fields, increments the GM counters, writes the audit rows. Returns a result object, never throws |
| `canEnterPrivateContest(userId, competition)` | Affiliated to `competition.gameMasterId` and that affiliation active |
| `resolveVisibilityPermission(subscription, pkg)` | Delegates to `resolveAllowedVisibility` |
| `getReportRows(filter, page)` | Admin reporting (s7), aggregation-based |

Rules the service enforces, each with a test:
- **Self-affiliation refused** (GM user id == joining user id).
- **Idempotent**: second Join GM to the same GM returns success with `alreadyAffiliated: true`, no second counter increment, no second audit row.
- **Terms must be the current version**: the acceptance id passed in must belong to this user, this GM, this slug, the page's current `version`, and be under 30 minutes old. A stale or someone else's acceptance id is refused. This is what makes "accepted the terms" provable rather than asserted by the client.
- GM counters are only incremented on insert, inside the transaction.
- Referral-link sign-up calls `affiliate({ source: "gm_referral_link" })` - its behaviour is unchanged (never blocks sign-up), but it now goes through the same door.
- Rate limit: Join GM 10 attempts / user / hour (existing `rateLimit` helper - verify which one the join and challenge routes use and reuse it).
- Fraud: `checkAccountStanding` is **not** consulted for affiliation (a restricted user may still be affiliated; entry is what restrictions block). Record a `gm_affiliation_created` event so the fraud team can see a burst of Join GMs to one GM from shared IPs - store `ipAddress` / `userAgent` on the row as sign-up already does.

---

## 4. Private competitions - enforcement at every door

The rule: **a `gm_private` contest can be entered, and its details read, only by users affiliated to its creating GM.** Discovery hides it from others; direct URL shows a Join GM gate, never the entry control.

> **BUILT 30 Sep 2026 (step 5): permission, creation, entry guard and discovery. Read the code, not the table below.** ~~The details-page gate, the per-contest API 404s, the admin badge and the notification exclusion are **step 6 and later, and not built.**~~ **The details-page gate and the per-contest 404s were built the same day as step 6** (see the step-6 note below). The admin badge and the notification exclusion are **still not built**, so that half of the sentence is still true.
>
> **BUILT 30 Sep 2026 (step 6): who may VIEW a private contest, and the Join GM gate.**
>
> **Live code:**
> - `lib/services/gamemaster/private-contest-access.service.ts`: `isPrivateContest`, `canViewContest`, `canViewContestById`.
> - `private-contest-gate.service.ts` beside it: `getPrivateContestGate`, the facts the gate renders.
> - `components/gamemaster/PrivateContestGate.tsx`, which reuses the leaderboard's terms dialog and join API.
> - The guard at the top of the lobby, `play`, `results`, `standings`, `status`, `live-ranking` and `rounds`.
>
> **The viewing rule, in order:**
> 1. Not private: allowed.
> 2. No signed-in user: refused.
> 3. The creating Game Master: allowed.
> 4. Holds a seat: allowed (D5, so a player whose Game Master changed keeps seeing the contest).
> 5. Otherwise `canEnterPrivateContest` with the viewer's current affiliation, which is the same rule the entry guard uses.
>
> Any error refuses (fails closed). `canViewContestById` answers **true for a contest that does not exist**, so each route's own not-found handling runs unchanged, rather than this helper inventing a second 404.
>
> **The gate replaces the entry button; it is never shown beside it.** Its state comes from `joinGmRowState`, the same decision the leaderboard row and `affiliate()` use, so the gate can never offer a join the API refuses. The states are:
> - `joinable`
> - `locked` (D1, naming the current Game Master)
> - `join_disabled` (the switch is off)
> - `signed_out`
> - `unavailable` (paused or deleted Game Master, D7)
>
> After joining, the page calls `router.refresh()` and the server re-reads eligibility. The join response is never trusted for this.
>
> **Six things worth carrying:**
> 1. **404, never 403.** A 403 confirms to an outsider that a private contest exists under that id.
> 2. **`live-ranking` checks BEFORE its shared cache.** The cache is keyed by contest, not by viewer, so a check placed after the cache read would serve the ranking to whoever asked second.
> 3. **`status` judges the session, never its `userId` query parameter.** That parameter is caller input; trusting it lets anybody claim to be a seated player. ~~The pre-existing leak is still open on **public** contests: the parameter still reveals any user's rank and prize there. It is recorded in `17` R117 and not fixed here, because it is not about privacy.~~ **Closed 1 Oct 2026:** the parameter is now ignored entirely. The ranking fields (`userRank`, `isWinner`, `prizeWon`) are the signed-in caller's own, and are only reported once the contest is completed. `CompetitionStatusMonitor` was the only sender and always sent the viewer's own id, so its behaviour is unchanged. Pinned by "status reports the ranking of the signed-in caller only" in `gm-private-contest-view.test.ts`, and by probe 114. Probe 96 was re-aimed at the session fallback.
> 4. **`app/api/competitions/[id]/participant-status` was DELETED, not guarded.** Nothing called it, it had no authentication, and it returned any user's status, capital and P&L for any contest. A route nobody calls is still reachable over HTTP (the Prerequisite B precedent).
> 5. **The gate records the Game Master's USER id on the terms acceptance and puts the SUBSCRIPTION id in the join URL.** The two ids are not interchangeable, and a test asserts the whole gate object.
> 6. **The join records where it came from.** `affiliatedVia.surface: "private_contest"` plus the `competitionId`. The id is reporting only: it is shape-checked and never used to decide anything, and a malformed one falls back to `"leaderboard"`.
>
> **`positions/check` needed no change.** It returns only the caller's own positions, so it cannot reveal anything about a contest the caller has no seat in.
>
> **Also fixed on the way:** `competition-id-guard.test.ts` had gone stale since 23 Sep 2026, when `/trade` became a redirect to `/play` and stopped reading the contest. It now asserts the guard precedes the redirect. No behaviour changed.
>
> **Still not built, and must not be summarised as done:**
> - ~~The admin **Private** badge~~ and filter in the competitions list (step 7). **The badge was built 1 Oct 2026; the filter is still not built** (it belongs with the rebuilt admin Game Master area).
> - Excluding private contests from platform-wide announcements (step 8).
>
> **BUILT 1 Oct 2026: the private badge on the game page and in the admin list.**
> - **Game page** (`/games/[slug]`): `listContestsForGame` now runs the same `annotatePrivateContests` the competitions list uses, so each private contest carries `privateAccess` and the Game Master's name. `GamePageContests` renders the same `PrivateContestBadge`, and swaps "Join Competition" for the same `PrivateContestCardAction` ("Join GM to enter" / "Members only") for a non-member. The wording therefore has one source.
> - **A seat counts as membership here (D5).** The competitions card checks its own seated state first; the game page has no seated state, so the catalogue looks up the viewer's own seats among the private contests in one query and reports them as `member`. The lookup compares `competitionId` as a **string**, because the participant model declares it `String`.
> - **Behaviour change: "Play now" skips private contests the player cannot enter.** `resolvePlayNowHref` used to pick the first live contest. It now ignores a private one unless the player is a member, falling through to the next contest, practice or a challenge. The card itself still offers "Join GM to enter".
> - **Admin list:** `CompetitionsListSection` shows an amber **Private** badge beside the creator badge, read through `resolveCompetitionVisibility` (absent, `null` or `""` means public). Nothing in the admin list's data changed: `GET /api/competitions` already returned `visibility`.
> - **Tests and probes:** `__tests__/services/gm-private-game-page.test.ts` (7 tests). Probes 115-120 are all red on exactly one test.
>
> **Tests and probes:** `__tests__/services/gm-private-contest-view.test.ts` has 24 tests, and `gm-leaderboard-join` has 2 more. Probes 86-104 are all red on exactly one test. One clause is deliberately unprobed, with the reason in the harness: the signed-out refusal. Removing it changes no answer, because a blank id finds no seat and no affiliation.
>
> **Live code:**
> - `lib/services/gamemaster/visible-contests.ts` (model-free, main app only): `publicContestsFilter`, `visibleContestsFilter`, `withVisibleContests`, `canEnterPrivateContest`.
> - `contest-viewer.service.ts` and `request-contest-viewer.ts` beside it: who is looking.
> - `visibility-permission.ts` (`checkVisibilityAllowed`, `parseAllowedVisibilityInput`), mirrored into `apps/admin` and held byte-identical by a test.
> - `gm-program-flags.ts`, now also mirrored.
> - The `private_not_affiliated` guard in `lib/services/contest-entry.service.ts`.
> - `components/gamemaster/ContestVisibilityPicker.tsx` and `apps/admin/components/admin/gamemaster/PackageVisibilityField.tsx`.
>
> **Eight deviations from the table, recorded rather than absorbed:**
> 1. **The discovery filter is `$in: [null, "", "public"]`, NOT `$ne: "gm_private"`.** `resolveCompetitionVisibility` reads any unrecognised stored value as private. `$ne` would list such a contest to everybody, so the list and the entry gate would disagree about one document, in the direction that leaks. `null` inside `$in` still matches a missing field, so pre-migration contests stay listed.
> 2. **The narrowing is `$and`, never a spread.** Several readers already carry their own `$or`, and spreading a second one over it silently replaces the first.
> 3. **The viewer set is `[affiliatedGameMasterId, userId]`**, so a Game Master can find the private contest they just created. `resolveContestViewer` never throws: a failed affiliation read degrades to public contests only, never to an error page and never to everything.
> 4. **More readers than the table names.** The filtered readers are:
>    - `app/api/competitions`
>    - the `competition.actions.ts` list reads
>    - the public arena (`app/api/dashboard/competitions`, no session, so public only)
>    - `game-suggestions.service.ts`, `game-page.service.ts`, `player-catalogue.service.ts` and the game page
>    - **three** landing feeds (`landing/competitions`, `leaderboard-preview`, `live-activity`)
>
>    **Two named readers need no filter: `comprehensive-dashboard.actions.ts` and `dashboard-live`.** Both load only contests the player already holds a seat in, and D5 says a seated player keeps seeing their contest.
> 5. **`gmPrivateContestsEnabled` gates CREATION only.** The entry guard and the filters run regardless, as s10 requires. Turning the switch off stops new private contests, and existing ones stay private.
> 6. **Refusal order: an unknown value, then the switch, then the package.** An unknown requested value is **refused** (`visibility_unknown`, 400) rather than read as private. That function reads caller input, where guessing either way stores a visibility nobody chose. The package precedence is current package, then cached limits, then default public. **An admin creation override does not widen it**, just as it never widens `allowedGameTypes`.
> 7. **The package editor needed its own validator**, `parseAllowedVisibilityInput`. The marketplace PUT writes with `findByIdAndUpdate` and no `runValidators`, so the schema enum never ran on that path. It refuses an empty list, because `[]` resolves to public-only and the editor and the routes would then disagree.
> 8. **The creation picker is fed by `GET /api/gamemaster/creation-options`**, so the browser never works out the allow-list for itself. The batch simulator route refuses a private contest outright, because it has no affiliation context.
>
> **Where the entry guard sits:** after the existing-seat return, so a seated player re-enters idempotently (D5), and before any wallet read. It covers both gates. Gate B answers 403.
>
> **A live defect found on the way, and found only because a typecheck error DISAPPEARED:** Gate B's `STATUS_BY_CODE` had no entry for `own_contest`.
> - The gap dates from 24 Sep 2026 (`9b8c7c64`).
> - A Game Master pressing Join on their own contest was refused correctly, but with HTTP 500, which reads as a server fault.
> - The missing key had sat in the 228-error baseline for six days.
> - Fixed, pinned by a test, and probed. No money moved.
>
> Tests: 61 new across `gm-private-entry` (10), `gm-private-discovery` and `gm-visibility-permission`. Probes 63-85 are all red on exactly one test. Risk **R117** in `17`.

> **OWNER-DIRECTED DEVIATION, 30 Sep 2026 (after step 6): private competitions are LISTED to every signed-in player.** The step-5 design above hid a private contest from the lists of anybody outside the Game Master's group. The owner reversed that: *"all must be able to see them, so if they are not under the specific GM, the ones that don't have another GM can join the GM from the competition."* The step-5 note is kept as it was written, because the reversal is the fact worth carrying. **What is true now:**
>
> - **Listing and entering are two filters.** `visibleContestsFilter` answers `{}` (every contest) for a signed-in viewer and public-only for an anonymous one. The old step-5 rule survives unchanged as **`enterableContestsFilter` / `withEnterableContests`**, which **game suggestions** use, because a suggestion is an invitation to play and must not suggest a contest the player cannot enter.
> - **Anonymous readers stay public-only.** The landing feeds and the public arena pass no viewer.
> - **A card tells a non-member what they need to do** instead of offering an entry button that would be refused. `annotatePrivateContests` (`lib/services/gamemaster/private-contest-listing.service.ts`) stamps `privateAccess` and `privateGameMasterName` on the list read by `getCompetitions` and `GET /api/competitions`:
>   - `member`: the creator, or a player affiliated to that Game Master. The card is unchanged.
>   - Anybody else gets **the lobby gate's own state** from `getPrivateContestGate`, so the card and the lobby cannot disagree. D4 (an expired Game Master frees the player) is honoured for free this way, which `getAffiliation` alone could not tell apart.
>   - The card shows a **Private** badge and **Join GM to enter**, **Members only** (D1: locked under another Game Master, and the hint says only an admin can move them) or **Sign in to join**. It links to the lobby, where `PrivateContestGate` performs the join. A seated player always gets the normal button (D5).
> - **Nothing about entry or viewing changed.** `private_not_affiliated` in `enterContest` and `canViewContest` on the lobby, `play`, `results` and the per-contest APIs are exactly as step 6 left them, so being able to *see* a card never lets anyone *enter* or read the leaderboard.
> - **Deviation 2's reason moved.** For a signed-in viewer the listing filter is `{}`, so `$and` and a spread behave the same there. The `$and` is still load-bearing in two places: for an anonymous viewer against a query carrying its own `visibility`, and in `withEnterableContests`, whose affiliated filter is itself an `$or`. Each place has its own test and probe (70 and 113).
> - The gate copy now reads *"can enter this competition or see its leaderboard"*, since seeing that the contest exists is no longer members-only.
>
> **Not built:** a Private badge on the game page's contest list (`player-catalogue`), which lists private contests now but does not annotate them. Clicking one still reaches the gate, so nothing is exposed.
>
> Tests: `gm-private-listing.test.ts` (14) and flipped/new cases in `gm-private-discovery.test.ts`. Probes 105-113 are all red on exactly one test.

| Door | Change |
|---|---|
| Creation - `app/api/gamemaster/competitions` (main) and `apps/admin/app/api/gamemaster/competitions` | Accept `visibility`; refuse a value not in `resolveAllowedVisibility`, naming who refused (override / package / default, as `creationDecidedBy` does). Stamp it on the insert (raw driver, so set explicitly - the schema default does not run on this path, R7) |
| GM creation UI (`components/gamemaster/*`) | Public / Private selector, only the allowed options shown, explanation of who can enter |
| Entry - `enterContest` | New guard after `own_contest`, before the seat check's "full" branch and the wallet read: `if (competition.visibility === "gm_private" && !actor.trusted) canEnterPrivateContest(...)` -> `fail("private_not_affiliated", ...)`. Covers **both** gates (server action and `POST /api/competitions/[id]/join`) because both call it. Idempotent re-entry of an already-seated player stays allowed (D5): the check sits **after** the existing-seat return |
| Batch simulator route (fixed-in-place writer) | Refuses `gm_private` contests outright - it has no affiliation context. Count writers again before building (the rule: four entry paths were once two) |
| Discovery - `app/api/competitions/route.ts`, `competition.actions.ts` list reads, `comprehensive-dashboard.actions.ts`, `dashboard-live`, `app/api/dashboard/competitions` (public arena), `game-suggestions.service.ts`, landing-page contest feeds | Filter `visibility: { $ne: "gm_private" }` **unless** the viewer is affiliated to that contest's GM (one `$or` clause built by a shared `visibleContestsFilter(viewer)` helper). `$ne` also matches contests with no field, so pre-migration contests stay visible. The **public arena route has no session** -> always excludes private |
| Details page `app/(root)/competitions/[id]/page.tsx` and `results`, `trade`, `play` | Server-side check. Not affiliated: render a **private-contest gate** (name, GM, entry fee, Join GM CTA) - no leaderboard, no participant names. `play`/`trade` redirect to the lobby gate. Seated player (D5) sees everything |
| Per-contest APIs: `standings`, `live-ranking`, `participant-status` (**deleted in step 6** - uncalled and unauthenticated), `status`, `rounds`, `positions/check` (no change needed - caller's own positions only) | Same check; 404 (not 403) for a non-affiliated, non-seated caller, so the API does not confirm a private contest exists |
| Admin | Unchanged visibility (operators see all) plus a **Private** badge and a filter in the competitions list |
| Notifications / emails announcing new contests | Exclude private contests from platform-wide announcements; optionally notify the GM's affiliates only (s6) |

**Note:** the brief's "payments/Volts" door is `enterContest` itself - the fee is taken inside the transaction after the guard, so there is no separate payment path to protect. Say that in the chapter rather than inventing a second check.

---

## 5. Gamemaster Affiliation Terms

> **BUILT 30 Sep 2026 (step 3) - read the code, not this section.** Live code:
> `lib/services/gamemaster/gm-terms-rules.ts` (pure, **model-free by requirement** - the
> `"use client"` dialog imports the slug from it, R58), `lib/services/gamemaster/gm-terms.service.ts`
> (main app only - R42, nothing in `apps/admin` calls it), `lib/constants/gm-affiliation-terms-page.ts`,
> `withMissingSystemPages` in `lib/services/site-page-seed.service.ts`, the GM branch of
> `app/api/terms-acceptance/route.ts`, the no-fallback rule in `app/api/action-terms/[slug]/route.ts`,
> the recorded mode of `components/ActionTermsDialog.tsx`, and `apps/admin/lib/admin/site-page-version.ts`
> used by the admin `PUT /api/pages/[slug]`. 26 tests in `__tests__/services/gm-terms.test.ts`,
> probes 29-40 in `tools/probe-gm-program.ps1` (38 of 38 red on exactly one test). **Nothing is
> player-visible yet** - no screen offers Join GM until step 4, so the recorded dialog has no caller.
>
> **What an acceptance proves, and every clause is checked:** THIS player, THIS slug, THIS Game
> Master, THIS version, and less than **30 minutes** old (60s of clock skew tolerated). Each missing
> clause is a different way to join one Game Master on consent given to something else - an id for
> GM_2 presented to join GM_1 is a real document proving nothing about this join.
>
> **Five deviations from the plan above, recorded rather than absorbed:**
> - **5.2's "bumped by the admin editor" is done by the SERVER, not the operator.** The PUT bumps
>   `version` whenever title, subtitle or section content changes on an `action_terms` page, and
>   **never reads `body.version`**. Left to the operator, one forgotten field keeps every old
>   acceptance valid against new wording with nothing failing. Toggling `isActive` or
>   `showEveryTime` changes no words and does **not** bump. The `SitePage` model comment still says
>   "operator-set"; it is now server-set for `action_terms` pages.
> - **5.4 is wider than stated: fail closed covers MISSING and UNVERSIONED too, not only
>   deactivated.** The page definition carries `requiresLivePage: true`, and the public route serves
>   **no built-in fallback** for it - every other action-terms page still falls back. Serving the
>   built-in text would record consent to words the operator never published or has withdrawn.
> - ~~**5.3 (the sign-up checkbox) is DEFERRED.** The referral link therefore still needs no consent;
>   `affiliate()` verifies an acceptance on that channel only when an id is supplied. Join GM always
>   requires one. A document saying referral sign-ups now record consent is wrong.~~ **Superseded 1 Oct
>   2026 by the first-visit prompt below.** A referral link no longer attaches anybody at sign-up, and
>   `affiliate()` now requires consent on every channel. Correct as history, stale as a present fact.
> - **`withMissingSystemPages` was added**, because the seeder prefers a saved
>   `data/defaults/pages.json` and one saved before this page existed would never seed it. It adds
>   missing **system** pages only and overrides nothing.
> - **Verification is wired into `affiliate()` now** (s3's "must present that id") rather than
>   waiting for step 4: consent is checked only after the rules say a row would be created, so an
>   idempotent repeat or a D1 refusal never asks for terms, and before any write, so a refusal leaves
>   nothing behind. A refusal writes a `gm_affiliation_refused` audit row; a recorded acceptance
>   writes `gm_terms_accepted`. The affiliation row carries `termsAcceptanceId`, `termsSlug`,
>   `termsVersion`.
>
> **Two things recorded, not fixed.** The admin `seedPagesFromDefaults` does `deleteMany` then
> `insertMany` from its own list, so running it from Admin can drop the GM page until the main app's
> startup seeder re-adds it - and while it is gone Join GM refuses, which is the safe direction.
> One probe is deliberately absent: the acceptance route's own 400 for a missing Game Master is
> covered by the service's `invalid_input` (also 400), so the two guards cover each other.
> **Never verified by eye.**

5.1 **Seed** a new default page in `lib/constants/default-pages.ts`: slug `terms-gamemaster-affiliation`, category `action_terms`, title "Gamemaster Affiliation Terms", `showEveryTime: false`, `version: "1"`. Content covers: what affiliation means and that it is permanent unless an admin reassigns; that the GM earns a percentage of the platform fee on the user's paid entries (competitions, and challenges where the package allows), **at no extra cost to the user**; that the GM will see the user's display name, email and country (owner, s1 D6); access to that GM's private contests; that switching GMs is not self-service. Editable in Admin -> Site Pages, **not hard-coded** - the dialog renders the page.
5.2 **Acceptance flow** reuses `ActionTermsDialog` with the GM's name interpolated as a variable (no per-GM page). POST `/api/terms-acceptance` gains optional `context.gameMasterId`; the route stores `termsVersion` from the live page and returns the acceptance id; the Join GM call must present that id (s3).
5.3 **Referral-link sign-up**: the sign-up form shows a required "I accept the Gamemaster Affiliation Terms" checkbox **only when `?ref=` is present and resolves to an active GM**; the acceptance is recorded after the user exists. Existing referral users (pre-v2) have no acceptance - D6 keeps their data sharing as today.
5.4 If the page is **deactivated** by an admin, Join GM is refused with a clear message rather than skipping terms (fail closed).

> **BUILT 1 Oct 2026 (programme v2, owner instruction): a referral link asks once, on the first
> visit, instead of a sign-up checkbox.** This deviates from 5.3. The owner asked for a pop-up on
> the player's first visit, because the sign-up form has no room for terms.
>
> **Live code:**
> - `lib/services/gamemaster/referral-claim-rules.ts` (pure, model-free, R58);
> - `referral-claim.service.ts` (main app only, R42);
> - `database/models/gamemaster/gm-referral-claim.model.ts` (`gm_referral_claims`; main app only,
>   since nothing in `apps/admin` reads it);
> - `GET/POST /api/gamemaster/referral-claim`;
> - `components/gamemaster/GmReferralTermsPrompt.tsx`, mounted in `app/(root)/layout.tsx`;
> - `recordReferralClaim` in `lib/actions/auth.actions.ts`.
>
> Tests: 19 in `__tests__/services/gm-referral-claim.test.ts`, plus flipped assertions in
> `gm-affiliation-service`, `gm-terms` and `gm-program-data-model`. Probes 161-170, each red on
> exactly one test.
>
> - **Sign-up attaches NOBODY.** It records a `pending` claim and nothing else, so the referral
>   writes no row and pays no commission until the player accepts. **Accept** goes through
>   `affiliate()` with the acceptance id, which is still the single writer. **Decline is final**,
>   and the player is never asked again. **Closing the dialog is not an answer**: it opens a
>   confirm step that can be left only by Decline or by going back to the terms. A player who never
>   answers is never attached.
> - **The prompt asks `decideAffiliation`, never a copy of D1/D4.** Another active Game Master
>   (D1) lapses the claim. An expired previous Game Master (D4) shows the prompt. A **suspended**
>   Game Master makes the prompt **wait** rather than lapse, because the player has not said no.
> - **`accepting` is a claim state with a 2-minute takeover** (`ACCEPTING_STALE_MS`), so two tabs
>   cannot both accept, and a crashed Accept cannot strand the claim. A retryable refusal
>   (`RETRYABLE_ACCEPT_CODES`, a `Set`) puts the claim back to `pending`.
> - **The route takes the user from the session, never from the body.**
> - **Audited:** `gm_referral_link_pending`, `_declined` and `_lapsed` were added to the admin
>   `customer-audit-trail` enum (add-only). Each write is best-effort and happens after the state
>   change.
>
> **Expiry and D4, verified rather than assumed.** A player whose Game Master has **expired** may
> join another. A player whose Game Master is merely paused or suspended may not. Only an admin
> move changes that. One gap is recorded: a subscription becomes `expired` only when the daily job
> `worker/jobs/gamemaster-renewal.job.ts` runs, so the player is freed **up to a day late**. That
> errs in the safe direction (locked a little longer). It is not fixed here.
>
> **Never verified by eye.**

> **BUILT 1 Oct 2026 (programme v2 task 5): the Game Master's own referral screens obey D6.**
> Recorded as **R118** in `17`, because the old routes leaked.
>
> **Live code:**
> - `lib/services/gamemaster/gm-referral-view.ts` (`toGameMasterReferralView`, `CONTACT_HIDDEN_NOTE`);
> - `contactRequiresConsent` on `ReferredPlayersFilter`, in both `referral-report-filter.ts` copies
>   and both `referral-read-model.ts` copies (mirrored, byte-identical test);
> - `app/api/gamemaster/{referrals,dashboard}/route.ts`;
> - `components/gamemaster/GmReferralBadges.tsx`;
> - the referrals tab and `app/(root)/gamemaster/referrals/page.tsx`.
>
> Tests: 20 in `__tests__/services/gm-referral-view.test.ts`. Probes 171-179, each red on exactly
> one test.
>
> - **Both routes read task 3's shared model**, scoped to `{ gameMasterIds: [sessionUserId],
>   contactRequiresConsent: true }`. The scope is spread last, so the query string cannot point the
>   read at another Game Master.
> - **The email shows only when `termsAccepted === true`.** Otherwise the screen says "Contact
>   hidden - terms not accepted". The view lists every field it returns, so `signupIP` and
>   `signupUserAgent` can no longer arrive by spread.
> - **Search cannot find a hidden email.** With the flag set, an email match also needs a stored
>   acceptance. The flag is never read from the query, and the admin report does not set it.
> - **Badges:** "Own referral" or "External" with the surface label, from `REFERRAL_KIND_LABELS` /
>   `REFERRAL_SURFACE_LABELS`, never hard-coded. An ended affiliation reads **Ended**, not Inactive.
>   The list gains a Source filter and Own/External counts.
> - **Deviation from D6's last sentence, recorded:** D6 says referral-link players who never
>   accepted terms "keep today's visibility". The build **hides** their email instead. Today's
>   visibility was the R118 leak, and an affiliation with no acceptance is not consent to share.
>   This fails closed. The display name is still shown.
> - **Not built:** country (D6 names it, but no field carries it on this read). A further change in
>   behaviour: entry fees and earnings now exclude cancelled earnings and count only within the
>   affiliation window, because they come from the shared model.
>
> **Never verified by eye.**
>
> **Amendment, 1 Oct 2026 (R120, owner request): a package switch for external referrals.**
> `gameMasterConfig.showExternalReferralDetails` is set in the marketplace package editor and
> cached on `subscription.limits`.
> - **Off, which is the default and also applies when the field is absent:** an **external**
>   referral (`chartvolt_join_gm` / `admin_assigned`) shows `**********` for the email and the
>   surname, plus the full client id.
> - **On:** full details are shown.
> - **Own referrals are never masked**, and D6 applies first, so no terms means no email.
> - The current package outranks the cache, and only `=== true` reveals.
> - A masked row is searchable **only** by exact client id or by the start of the first name, so
>   a guessed email cannot confirm itself.
> - Existing packages are masked until an admin turns the switch on. That is deliberate and
>   fail-closed.
>
> **Amendment, 1 Oct 2026 (R119, owner test).** A detached player who rejoined showed twice in the
> admin report, as "inactive", while the Game Master saw them as active. The read model now groups
> by player and Game Master, sums contests and money across stints, and applies its filters after
> grouping. "Active" was two questions under one word, so all four screens now use one label,
> `describeAffiliationState`: "Ended", "Affiliated · played in last 30 days" or "Affiliated · no
> contest in 30 days". An admin move is now windowed from the new row's `referredAt`, not the epoch,
> so the new Game Master no longer inherits the old seats. A moved player still shows once under
> each Game Master. Tests are in `gm-referral-history.test.ts`.

---

## 6. Player surfaces

### 6.1 Gamemaster Leaderboard - `/leaderboard?tab=gamemasters` (or `/gamemasters`)

> **BUILT 30 Sep 2026 (step 4), SWITCHED OFF BY DEFAULT - read the code, not the bullets below.**
> Live code: `lib/services/gamemaster/gm-leaderboard-rules.ts` (pure, model-free - R58),
> `gm-leaderboard-metrics.ts` (the cached aggregate), `gm-leaderboard.service.ts` (paging + row
> state), `gm-program-flags.ts` (`isGmJoinEnabled`), `GET /api/gamemasters/leaderboard`,
> `POST /api/gamemasters/[subscriptionId]/join`, `components/leaderboard/GameMasterLeaderboard.tsx`,
> the `gmBoardEnabled` gate in `LeaderboardClient.tsx` / `app/(root)/leaderboard/page.tsx`,
> `RateLimiters.gmJoin`, `gmJoinEnabled` on both `whitelabel.model.ts` copies, and on the admin
> side `apps/admin/app/api/gamemasters/program-settings/route.ts` + `GmProgramSwitches.tsx`.
> 29 tests (`gm-leaderboard-rules.test.ts` 19, `gm-leaderboard-join.test.ts` 10), probes 41-58 in
> `tools/probe-gm-program.ps1`, each red on exactly one test. **Never verified by eye.**
>
> **Ten facts drift easily.**
> - **Dark means dark on BOTH routes and on the tab.** With `gmJoinEnabled` off the leaderboard
>   route and the join route both answer 403 `feature_disabled`, and the tab is not rendered - the
>   page reads the flag server-side and passes `gmBoardEnabled`, so `?tab=gamemasters` cannot reach
>   a board the server would refuse. **Only a stored boolean `true` is on**; absent, `null` and a
>   legacy string `"true"` all read as off (a probe makes the check truthy and a test goes red).
> - **The switch is on the existing Game Master screen, not a new section** - a deviation from s7,
>   which puts everything under a redesigned `GameMasterProgramSection`. It sits above the Sync
>   Referrals panel in `GameMasterManagementSection.tsx` (3 lines added), behind the same
>   `gamemaster-management` grant, because s7's redesign is step 7 and an operator must be able to
>   switch step 4 on before then. The route is a **named `Set` allow-list**, refuses an unknown
>   field by name, refuses a non-boolean, upserts, and writes `logSettingsUpdated` with before/after.
> - **Every join rule is `affiliate()`'s.** The route adds only transport, in a pinned order:
>   session, switch, `RateLimiters.gmJoin` (10 an hour per user, counted **before** the body is
>   read so garbage requests spend the budget), then the body. Channel `chartvolt_join_gm`,
>   surface `leaderboard`. Refusals map through `JOIN_GM_REFUSAL_STATUS`, a `Map`; an unlisted code
>   is 500 with the generic message, never a success.
> - **The row's button state is decided by `decideAffiliation`**, the function `affiliate()` calls,
>   via `joinGmRowState` - `own` (no button), `your_gm` (badge), `locked` (greyed, D1 tooltip),
>   `joinable`. A test asserts every row state agrees with the decision on the same facts, so the
>   board cannot offer a join the server refuses or grey out one it allows. A paused current GM
>   still **locks** (only expired/deleted frees the player, D4).
> - **Consent is recorded against the GM's USER id** (`recordedContext.gameMasterId =
>   joining.gameMasterUserId`) while the join URL carries the **subscription** id - swapping them
>   makes every join refuse `terms_not_accepted`, because the stored acceptance names a different
>   Game Master than the one `affiliate()` checks against; probe 57.
> - **The public row is built from an explicit key list, never a spread** -
>   `GM_LEADERBOARD_ROW_KEYS`, asserted as the exact key set of every response row, with a
>   `totalEarnings: 999` seeded on the subscription to prove it cannot leak. No earnings, no email.
> - **Metrics are one cached aggregate, 5 minutes** (`GM_LEADERBOARD_CACHE_MS`), never per request.
>   Listed GMs only: `status: "active"`, not paused, not scheduled for deletion (D7). Drafts are not
>   counted as created; participants and entry Volts count only non-cancelled contests; **active
>   affiliate = entered a contest with `entryFee > 0` in the last 30 days**. Seats are joined by
>   converting `competition_participant.competitionId` (String) to ObjectId - the known trap, probe 52.
> - **Rank is the board's standing, not the sort** - active affiliates then affiliates, ties share a
>   rank, and re-sorting by another metric keeps each row's rank.
> - **Sort is a `Set` allow-list and an unknown sort is REFUSED (400)**, never silently defaulted;
>   page size is capped at 50.
> - **Nothing is player-visible until an operator flips the switch**, and the terms page from step
>   3 must be live, or every join refuses `terms_unavailable` (503).
- Same `LeaderboardClient` shell/tab pattern and neon kit as the existing board; paginated API `GET /api/gamemasters/leaderboard` (never ship the full list - the global board's own comment explains why).
- Metrics, **computed by a stored/cached aggregate, never on every request**: affiliated users, active affiliated users (entered a paid contest in last 30 days), competitions created, completed, total participants in their contests, total entry Volts generated, GM rank. **GM earnings are not shown** (owner, 30 Sep 2026) - they appear only in the admin report and the GM's own dashboard, and the leaderboard API must not select them (a test asserts the response fields).
- Sort by any metric; default sort = active affiliated users.
- **Join GM button** per row: hidden for your own row; "Your GM" badge if affiliated to that GM; **greyed out and not clickable**, with a tooltip saying only an admin can reassign, if affiliated to another GM (D1); otherwise opens terms -> confirm -> `POST /api/gamemasters/[subscriptionId]/join`.
- Only `status: active`, not paused, not scheduled for deletion.

### 6.2 Private competition page CTA

> **BUILT 30 Sep 2026 (step 6)** as `components/gamemaster/PrivateContestGate.tsx`. See s4's step-6 note. A paused or deleted Game Master shows an "unavailable" gate with no join offered (D7).
- Not affiliated: primary CTA **Join GM to enter** -> same terms dialog -> same join API -> on success the page calls `router.refresh()` and the normal `CompetitionEntryButton` appears (eligibility is re-read server-side, never trusted from the join response).
- Affiliated to a different GM: CTA replaced by an explanation; no join offered (D1).

### 6.3 GM dashboard (`app/(root)/gamemaster`)

> **BUILT 1 Oct 2026 except the private-contests count** - see the task-5 note at the end of s5.
- Affiliates list shows the **source badge** and terms-accepted date; shows contact details only for users covered by D6.
- New "Private contests" count and the link fix from s0.1.

---

## 7. Admin -> Gamemaster redesign

Split into new files under `apps/admin/components/admin/gamemaster/` (each < 500 lines): `GameMasterProgramSection.tsx` (tabs), `GmOverviewTab`, `GmAffiliatesReport`, `GmReportFilters`, `GmReportTable`, `GmExportButton`, `AffiliationSourceBadge`. The existing detail view stays reachable; `GameMasterManagementSection.tsx` is reduced to the GM list tab by moving code out, never by adding.

### 7.1 Report rows (one row per affiliated user)
GM, user, registration date, affiliation date, source (badge), affiliation status, active/inactive, country, package, competitions entered (total / in this GM's contests / public / private), challenges entered, games played (by `gameKey`), trading contests, entry Volts, qualifying activity, commission generated / paid / pending / cancelled (from `GameMasterEarning.status`), retained GM fee attributed to this user, refunds, admin adjustments, first/last activity.

Sources, all read-only: `userreferrals`, `user`, `competition_participant` (+ `Competition` for GM/visibility/game - **attribute by the contest's labels, cast `competitionId` String -> ObjectId**, the known trap), `challenge_participant`, `wallettransactions` (entry, refunds), `gamemasterearnings` (grouped by `referredUserId`), `platform_financials` retained rows. Built as **one aggregation per page** with pre-computed per-user facts cached in a small `gm_affiliate_stats` read model refreshed by the worker every 15 minutes (report on 10k affiliates must not do 10k lookups per request). The report says "as of HH:MM".

> **BUILT 1 Oct 2026 (programme v2 task 3): the shared read model, NOT the report screen.** Live
> code: `lib/services/gamemaster/referral-kind.ts`, `referral-read-model.ts` and
> `referral-report-filter.ts` (all three **mirrored**, held byte-identical by a test -
> `check:mirrors` compares models and says nothing about them), the admin route
> `GET /api/gamemasters/referred-players` (`guardSection("gamemaster-management")`), and the
> Game Master's own list `app/api/gamemaster/referrals/route.ts`, which now carries `kind` and
> `surface` and escapes its search. Tests: `__tests__/services/gm-referral-read-model.test.ts`
> (35, against a real database), probes 121-141 in `tools/probe-gm-program.ps1`, each red on
> exactly one test. **Read the code, not the row list above.** Seven facts drift easily:
> - **Own versus external is decided in ONE table** (`KIND_BY_SOURCE`): `gm_referral_link` is
>   own, `chartvolt_join_gm` is external, and an absent, `null` or `""` `source` is legacy, which
>   means `gm_referral_link`. The JavaScript classifier and the Mongo `$switch` are both generated
>   from that table and a test proves they agree **row by row against a real database**, because
>   two spellings of one rule is the shape behind `referenceId`, `failedReason` and `challengeId`.
>   An unknown source has **no** kind and **no** surface on both sides.
> - **The counters stored on `UserReferral` are written by nothing** and the read model does not
>   read them. Activity comes from the seat collections, money from `gamemasterearnings`.
> - **Money is windowed by the affiliation**: cancelled earnings excluded, paid and pending split
>   by status, another Game Master's rows excluded, the window ends at `endedAt` (open rows run for
>   ever) and starts at `referredAt` for Join GM rows only. Link rows start at epoch, because a
>   link referral exists from sign-up and its `referredAt` is not always written at sign-up time.
> - **Deviation: "active" counts ANY seat in the last 30 days**, free or paid, while s6.1 says
>   paid. Recorded rather than absorbed - the paid version needs an entry-fee join this step
>   deliberately left out; revisit with task 7's money breakdown.
> - **Deviation: no `gm_affiliate_stats` cache and no worker.** One aggregation per page with
>   server-side paging (max 100 rows). The 15-minute read model is deferred until a real Game
>   Master has enough affiliates to measure; a cache built ahead of a measurement is a second
>   source that can disagree with the first.
> - **The signup IP is never selected**, asserted at the pipeline level and not only on the
>   mapped row, since a row mapper that drops it is green while the pipeline still carries it.
> - **Legacy link rows carry no `termsAcceptanceId`**, so `termsAccepted` is false for them and
>   D6 will hide their contact details. That is correct (they never accepted these terms) and it
>   will read as a bug to an operator - task 5 must say so on screen.
> Filters are allow-listed (`Set`s), dates are whole days, search is capped at 100 characters and
> regex-escaped, and nothing from the query string reaches an operator position. **Not built:** the
> report UI, exports, move/detach, the competition-type and country filters - task 4.

### 7.2 Filters (combinable, all server-side)
GM, user search, affiliation/registration/activity date ranges, source, affiliation status, active, competition type, public/private, game, trading, challenge, earnings/commission/entry-Volts ranges, country, package, commission status. Filters live in the URL (`?activeTab=gamemaster-management&...`) so a report is bookmarkable - the deep-link rule from `12` s1.1. Filter values are validated against **allow-lists (Sets)**; ranges are `Number.isFinite`-checked; nothing from the query string reaches a Mongo operator position.

### 7.3 Overview tab
KPIs for the filtered set (affiliates, active, by source, commission generated/paid/pending, retained fees), top GMs, source split chart. Same filter state as the table.

### 7.4 Exports
`GET /api/gamemasters/report/export?format=csv|xlsx&<same filters>` - **the full filtered set, streamed in batches**, not the visible page. Hard cap (e.g. 100k rows) with a clear message above it. CSV follows the existing export routes (escape `"`, **neutralise formula injection**: prefix cells starting with `= + - @` with `'`). XLSX: add **`exceljs`** to `apps/admin` only (verify current version and streaming writer API via Context7 before installing; justify in README). Every export writes an audit log row (who, filters, row count) - exports contain personal data.

### 7.5 RBAC
- Report + export behind `requireSectionAccess("gamemaster-management")`; export additionally behind new section id `gamemaster-reports-export` (add-only enum value) so the owner can grant viewing without bulk personal-data download.
- Route guard audit (`npm run audit:admin-routes`) must stay at 0 no-check.

> **BUILT 1 Oct 2026 (programme v2 task 4): the report screen, CSV export, move and detach.**
> Live code: `apps/admin/components/admin/GameMasterProgramSection.tsx` (two tabs - the existing
> Game Master list and the new Referred players report) and, under
> `apps/admin/components/admin/gamemaster/`, `GmReferredPlayersReport`, `GmReportFilters`,
> `GmReportSummary`, `GmReportTable`, `GmAffiliationActionDialog`, `GmExportButton`,
> `AffiliationSourceBadge`; the pure modules `apps/admin/lib/admin/gm-report-query.ts` (URL state)
> and `gm-report-csv.ts` (cells, columns, cap); the service
> `apps/admin/lib/services/gamemaster/admin-affiliation.service.ts`; and the routes
> `POST /api/gamemasters/referred-players/[userId]` (move / detach) and
> `GET /api/gamemasters/report/export`. **All admin-only; nothing here is mirrored** except the two
> model enums. Tests: `__tests__/admin/gm-admin-affiliation.test.ts` (10, real database),
> `gm-report-screen.test.ts` (25), `employee-email-template.test.ts` (2); probes 142-160, each
> red on exactly one test. Nine facts drift easily:
> - **The export needs BOTH grants** - `gamemaster-management` to see the data and the new
>   add-only `gamemaster-reports-export` to download it - and the dashboard passes the **export**
>   grant to the button, never the view grant; a probe swaps them.
> - **The export is the whole filtered set, streamed in batches of 500, capped at 10,000 rows.**
>   The plan said "e.g. 100k"; 10,000 was chosen because one aggregation per batch reads seats and
>   earnings, and nothing has been measured at 100k. Above the cap the route refuses with a message
>   naming the cap and telling the operator to narrow the filters.
> - **Every export is audited BEFORE the stream starts**, refused or not: `gm_report_exported` /
>   `gm_report_export_refused` in the system log, with the actor, the filters and the row count. A
>   test asserts the audit call sits before the `ReadableStream` is built, because an audit written
>   after streaming is lost whenever the download is interrupted.
> - **CSV only. Deviation: no xlsx and no `exceljs`.** The route refuses any other `format` with a
>   400 rather than silently sending CSV. A spreadsheet library is a new dependency in the app that
>   holds every secret, for a format CSV already opens in.
> - **Formula injection is neutralised inside the quotes.** A cell starting `= + - @`, tab or CR is
>   prefixed with `'`; plain numbers, including negatives, are left as numbers so a refund column
>   still sums. A cell that needs both is quoted *after* the prefix.
> - **Move and detach take a reason of 10-500 characters**, and the dialog's bounds are asserted
>   equal to the service's. Move refuses a paused, scheduled-for-deletion or expired target, and the
>   same Game Master; detach refuses a player with no Game Master. Each runs in one transaction that
>   ends the old row (`admin_reassigned` / `admin_detached`), moves the counters, and - **for
>   detach - `$unset`s `user.referredByGameMasterId`**, or settlement would keep paying the old
>   Game Master through the fallback.
> - **A moved row is `source: admin_assigned`, `surface: admin`, with no terms acceptance** - an
>   admin decision is not the player's consent, so D6 will hide that player's contacts from the new
>   Game Master too. Three add-only enum values in both `user-referral.model.ts` copies.
> - **Two audit stores, deliberately**: one customer audit row naming the real admin and the reason
>   (the player's history), and the system-log row in the route (the operator's). The customer row
>   is written after commit and best-effort, so an audit-store outage cannot roll back a move.
> - **Filters actually built:** Game Master, own/external, surface, affiliation status, active,
>   joined-date range, search, all in the URL under an `rp_` prefix so they cannot collide with the
>   dashboard's own parameters, and `gmId` still opens the list tab so the existing deep link
>   survives. **Not built:** competition-type, public/private, game, country, package and the money
>   range filters of s7.2, and the s7.3 charts - the overview is figures and an own/external/surface
>   breakdown only. **Never verified by eye.**
>
> **Found on the way, and fixed:** the employee credentials email substituted template variables
> with `String.replace`, which reads `$&` and `$$` in the replacement as patterns. The generated
> password alphabet contains both `$` and `&`, so a password containing `$&` was emailed as
> something other than the password stored. Now a literal split/join. Latent, nothing backfilled -
> an affected employee simply could not log in with the emailed password and would have been reset.

### 7.6 Package editor
Add "Competition visibility allowed: Public / Private / Both" to the GM package config in the marketplace item editor (admin), writing `gameMasterConfig.allowedVisibility`.

---

## 8. Registering the new actions elsewhere

| Where | What is recorded |
|---|---|
| `CustomerAuditTrail` (user logs in admin) | `gm_affiliation_created` (source, GM, terms version), `gm_affiliation_refused` (code), `gm_terms_accepted`, `gm_affiliation_reassigned` |
| Admin `AuditLog` | Admin reassignments, package visibility changes, report exports |
| `TermsAcceptance` | Every acceptance with version + GM context |
| GM dashboard / GM notifications | "New affiliate joined via ChartVolt" notification to the GM (new template in both `notification-template.model.ts` copies, `gamemaster` category, in-app only) |
| Player notifications | Confirmation "You are now affiliated with {GM}" (in-app) |
| Financial dashboard | **No new money rows** - commission already flows through `GameMasterEarning` and `retained_gm_fee`. Add a **breakdown by affiliation source** of GM commission and retained fees to the existing GM financial figures, so the owner can see what Join GM earns partners vs referral links |
| Admin wiki (`AdminWikiSection.tsx`) and help page | Replace `/register` link text; document Join GM, private contests, source badges |
| Fraud | Join-GM burst detector hook (shared IP/device to one GM) - record only in v2, auto-action is a separate decision |

---

## 9. Testing (same standard as X-phases: tests + probes, each probe red on exactly one test)

New suites (vitest, `mongodb-memory-server` replica set, `ensureCollections()` first, ObjectId-shaped user ids, whole-schema fixtures):

1. `gm-affiliation-service.test.ts` - self refused; idempotent same GM; other GM refused; 20 concurrent Join GMs for one user produce **exactly one** row and one counter increment; non-active/paused/scheduled GM refused; stale/foreign/expired acceptance id refused; both stores written or neither (abort mid-transaction); referral-link sign-up path writes `source: gm_referral_link`.
2. `gm-private-entry.test.ts` - non-affiliated refused with **no participant, no debit, no prize-pool change**; affiliated admitted; affiliated to another GM refused; seated player keeps idempotent success after affiliation ends; both gates (action + route) refused; simulator batch refuses private.
3. `gm-private-discovery.test.ts` - every list reader in s4 excludes private for strangers and includes it for affiliates; public arena route never returns it; per-contest APIs 404 for strangers; pre-migration contest (no field) visible.
4. `gm-visibility-permission.test.ts` - resolver: absent/empty -> public only; package-first precedence; both creation routes refuse a disallowed value and name who refused; stored value on raw-driver insert.
5. `gm-terms.test.ts` - version bump invalidates old acceptance; deactivated page refuses join; acceptance stores version + GM context.
6. `gm-report.test.ts` - filters combine; String/ObjectId cast; export returns full set beyond page size; CSV formula neutralisation; XLSX opens and has the same row count; export audit row written; section guard counted per handler.
7. Structural: **writer count** - only `affiliation.service.ts` writes `userreferrals` or `referredByGameMasterId` (strip comments, scan both apps); rules module byte-identical across apps; `visibility` in `NEVER_EDITABLE_FIELDS`; no `"use client"` file imports the service (R58).
8. Regression: settlement parity suites unchanged and green; a Join GM user's entry produces the **same** `GameMasterEarning` as a referral-link user's (behavioural, fee-for-fee).
9. s0.1 fixes: link helper used by both writers; `id`/`_id` lookup behavioural test (seed a user with `_id` only).

Probes: `tools/probe-gm-program.ps1`, UTF-8 no-BOM read/write, `-LiteralPath`, expected test named and run with `-t`, file-changed assertion. Minimum probes: remove the entry guard; move it after the wallet read; drop the discovery filter from each reader; accept any visibility at creation; skip the version check; skip the self check; remove the transaction; remove the export cap; remove formula escaping; remove a section guard.

Verification gates: `npm run check:mirrors`, main + admin `tsc --noEmit` diffed **by error list** against baseline, lint on touched files, admin + main `next build`, `audit:admin-routes`.

---

## 10. Migration and rollout (each step additive, flag-gated, app keeps working)

| Step | Content | Flag |
|---|---|---|
| **0** | s0.1 defect fixes + tests. Ships alone | none |
| **1** (**BUILT 30 Sep 2026**, backfill not yet applied) | Models (s2) + backfill script `tools/gamemaster/backfill-affiliation-source.ts`: sets `source: gm_referral_link` only where missing (absent, `null`, `""` all handled), refuses to overwrite, report-only until `--apply`. Since 30 Sep 2026 it also runs from the admin **Run migration** button (same function, audited). Index change only if D4 = yes | none (inert fields) |
| **2** (**BUILT 30 Sep 2026**) | Central service; sign-up rewired onto it (behaviour identical, pinned by the existing sign-up tests plus new ones) | none |
| **3** (**BUILT 30 Sep 2026**, sign-up checkbox deferred - see s5) | Terms page seed + acceptance versioning; server-side version bump; Join GM verifies consent | none |
| **4** (**BUILT 30 Sep 2026**, dark by default - see s6.1) | Join GM API + leaderboard; admin switch on the existing Game Master screen (deviation from s7, recorded in s6.1) | `WhiteLabel.gmJoinEnabled` (default false) |
| **5** (**BUILT 30 Sep 2026** - see s4's BUILT note) | Visibility permission in packages + creation routes + entry guard + discovery filters | `WhiteLabel.gmPrivateContestsEnabled` (default false). **Entry guard and discovery filters ship ON regardless of the flag** - they are inert while no private contest exists, and a private contest must never exist without them |
| **6** (**BUILT 30 Sep 2026** - see s4's step-6 note) | Private contest gate + Join GM CTA; every per-contest page and API refuses an outsider with 404 | same flag for creation. The view check ships ON regardless, like the entry guard. **After this step, `gmPrivateContestsEnabled` can be switched on**; the admin badge (step 7) and the announcement exclusion (step 8) are still open |
| **7** | Admin redesign, filters, read model, exports, RBAC section | none (admin only) |
| **8** | Notifications, financial breakdown, wiki/help, fraud hook | none |

Rollback: flags off; fields are inert; no data deleted. A private contest already created stays private (the guard is not flag-dependent) - that is deliberate.

---

## 11. Risks (next free number is R120 since R119 on 1 Oct 2026 - re-check with `rg -o "R\d+"` before adding)

- **R117 - private contest leaks through an unfiltered reader.** Many list readers exist; the fix is the shared filter helper plus the per-reader test in s9.3. High likelihood if done per call site.
- **R118 - Join GM becomes a commission-farming tool** (GM creates accounts, joins them, enters own private contests). Mitigated by: GM cannot enter own contests (exists), affiliation needs a real account + terms, existing fraud detectors on entry, burst recording. Residual: owner decision on auto-action.
- **R119 - double affiliation under concurrency.** Unique index + transaction + E11000 classification; concurrency test.
- **R120 - personal-data export.** Separate RBAC section, audit row per export, row cap.
- Existing **19 s5 constraint unchanged**: private visibility is a second, independent permission and **does not widen `allowedGameTypes`** - a package allowing `gm_private` still creates only the games it already allowed, and Game Masters still cannot create provider contests (`19` s3.2a).

---

## 12. Documents to update as each step lands

`PROGRESS.md` (status row + work log per step), `19-game-masters.md` (built rows, s1 tables, s6 defects), `17-risk-register.md` (R117-R120; the s0.1 findings are R116), `04-data-model.md` (new fields), `13-user-ui-and-routes.md` (leaderboard, private gate), `12` (admin section), internal HTML E5/E6 and s15, `README.md` (exceljs), admin wiki, help page, `legal/ChartVolt-Regulatory-Defence-Pack.html` **only if** the owner decides the terms change the money-flow description (commission is from platform fee, not from the player, so probably not - check).

## 13. Estimate

Step 0: 1-2 days. Steps 1-3: 3-4 days. Steps 4-6: 5-7 days. Step 7: 5-7 days. Step 8: 2 days. Tests/probes/docs are included in each. **Total ~3.5-4.5 weeks**, sequenced so the platform is shippable after every step.
