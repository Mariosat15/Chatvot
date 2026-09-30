# 24 - Game Master Program v2: private contests, Join GM, leaderboard, terms, admin reporting

**Status (30 September 2026): steps 0-4 BUILT (step 4 dark behind `gmJoinEnabled`); steps 5-8 are plan only.** This line
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

| Door | Change |
|---|---|
| Creation - `app/api/gamemaster/competitions` (main) and `apps/admin/app/api/gamemaster/competitions` | Accept `visibility`; refuse a value not in `resolveAllowedVisibility`, naming who refused (override / package / default, as `creationDecidedBy` does). Stamp it on the insert (raw driver, so set explicitly - the schema default does not run on this path, R7) |
| GM creation UI (`components/gamemaster/*`) | Public / Private selector, only the allowed options shown, explanation of who can enter |
| Entry - `enterContest` | New guard after `own_contest`, before the seat check's "full" branch and the wallet read: `if (competition.visibility === "gm_private" && !actor.trusted) canEnterPrivateContest(...)` -> `fail("private_not_affiliated", ...)`. Covers **both** gates (server action and `POST /api/competitions/[id]/join`) because both call it. Idempotent re-entry of an already-seated player stays allowed (D5): the check sits **after** the existing-seat return |
| Batch simulator route (fixed-in-place writer) | Refuses `gm_private` contests outright - it has no affiliation context. Count writers again before building (the rule: four entry paths were once two) |
| Discovery - `app/api/competitions/route.ts`, `competition.actions.ts` list reads, `comprehensive-dashboard.actions.ts`, `dashboard-live`, `app/api/dashboard/competitions` (public arena), `game-suggestions.service.ts`, landing-page contest feeds | Filter `visibility: { $ne: "gm_private" }` **unless** the viewer is affiliated to that contest's GM (one `$or` clause built by a shared `visibleContestsFilter(viewer)` helper). `$ne` also matches contests with no field, so pre-migration contests stay visible. The **public arena route has no session** -> always excludes private |
| Details page `app/(root)/competitions/[id]/page.tsx` and `results`, `trade`, `play` | Server-side check. Not affiliated: render a **private-contest gate** (name, GM, entry fee, Join GM CTA) - no leaderboard, no participant names. `play`/`trade` redirect to the lobby gate. Seated player (D5) sees everything |
| Per-contest APIs: `standings`, `live-ranking`, `participant-status`, `status`, `rounds`, `positions/check` | Same check; 404 (not 403) for a non-affiliated, non-seated caller, so the API does not confirm a private contest exists |
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
> - **5.3 (the sign-up checkbox) is DEFERRED.** The referral link therefore still needs no consent;
>   `affiliate()` verifies an acceptance on that channel only when an id is supplied. Join GM always
>   requires one. A document saying referral sign-ups now record consent is wrong.
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
- Not affiliated: primary CTA **Join GM to enter** -> same terms dialog -> same join API -> on success the page calls `router.refresh()` and the normal `CompetitionEntryButton` appears (eligibility is re-read server-side, never trusted from the join response).
- Affiliated to a different GM: CTA replaced by an explanation; no join offered (D1).

### 6.3 GM dashboard (`app/(root)/gamemaster`)
- Affiliates list shows the **source badge** and terms-accepted date; shows contact details only for users covered by D6.
- New "Private contests" count and the link fix from s0.1.

---

## 7. Admin -> Gamemaster redesign

Split into new files under `apps/admin/components/admin/gamemaster/` (each < 500 lines): `GameMasterProgramSection.tsx` (tabs), `GmOverviewTab`, `GmAffiliatesReport`, `GmReportFilters`, `GmReportTable`, `GmExportButton`, `AffiliationSourceBadge`. The existing detail view stays reachable; `GameMasterManagementSection.tsx` is reduced to the GM list tab by moving code out, never by adding.

### 7.1 Report rows (one row per affiliated user)
GM, user, registration date, affiliation date, source (badge), affiliation status, active/inactive, country, package, competitions entered (total / in this GM's contests / public / private), challenges entered, games played (by `gameKey`), trading contests, entry Volts, qualifying activity, commission generated / paid / pending / cancelled (from `GameMasterEarning.status`), retained GM fee attributed to this user, refunds, admin adjustments, first/last activity.

Sources, all read-only: `userreferrals`, `user`, `competition_participant` (+ `Competition` for GM/visibility/game - **attribute by the contest's labels, cast `competitionId` String -> ObjectId**, the known trap), `challenge_participant`, `wallettransactions` (entry, refunds), `gamemasterearnings` (grouped by `referredUserId`), `platform_financials` retained rows. Built as **one aggregation per page** with pre-computed per-user facts cached in a small `gm_affiliate_stats` read model refreshed by the worker every 15 minutes (report on 10k affiliates must not do 10k lookups per request). The report says "as of HH:MM".

### 7.2 Filters (combinable, all server-side)
GM, user search, affiliation/registration/activity date ranges, source, affiliation status, active, competition type, public/private, game, trading, challenge, earnings/commission/entry-Volts ranges, country, package, commission status. Filters live in the URL (`?activeTab=gamemaster-management&...`) so a report is bookmarkable - the deep-link rule from `12` s1.1. Filter values are validated against **allow-lists (Sets)**; ranges are `Number.isFinite`-checked; nothing from the query string reaches a Mongo operator position.

### 7.3 Overview tab
KPIs for the filtered set (affiliates, active, by source, commission generated/paid/pending, retained fees), top GMs, source split chart. Same filter state as the table.

### 7.4 Exports
`GET /api/gamemasters/report/export?format=csv|xlsx&<same filters>` - **the full filtered set, streamed in batches**, not the visible page. Hard cap (e.g. 100k rows) with a clear message above it. CSV follows the existing export routes (escape `"`, **neutralise formula injection**: prefix cells starting with `= + - @` with `'`). XLSX: add **`exceljs`** to `apps/admin` only (verify current version and streaming writer API via Context7 before installing; justify in README). Every export writes an audit log row (who, filters, row count) - exports contain personal data.

### 7.5 RBAC
- Report + export behind `requireSectionAccess("gamemaster-management")`; export additionally behind new section id `gamemaster-reports-export` (add-only enum value) so the owner can grant viewing without bulk personal-data download.
- Route guard audit (`npm run audit:admin-routes`) must stay at 0 no-check.

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
| **5** | Visibility permission in packages + creation routes + entry guard + discovery filters | `WhiteLabel.gmPrivateContestsEnabled` (default false). **Entry guard and discovery filters ship ON regardless of the flag** - they are inert while no private contest exists, and a private contest must never exist without them |
| **6** | Private contest gate + Join GM CTA | same flag |
| **7** | Admin redesign, filters, read model, exports, RBAC section | none (admin only) |
| **8** | Notifications, financial breakdown, wiki/help, fraud hook | none |

Rollback: flags off; fields are inert; no data deleted. A private contest already created stays private (the guard is not flag-dependent) - that is deliberate.

---

## 11. Risks (next free number is R117 - re-check with `rg -o "R\d+"` before adding)

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
